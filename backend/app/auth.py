import os
import bcrypt
import secrets
from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db, DBUser
from .schemas import User, UserCreate, UserUpdate

def get_secret_key() -> str:
    # 1. Try Environment Variable (Override)
    env_key = os.getenv("SECRET_KEY")
    if env_key:
        return env_key
    
    # 2. Try to read from data folder
    db_path = os.getenv("DB_PATH", "frosty.db")
    data_dir = os.path.dirname(db_path)
    if not data_dir:
        data_dir = "."
    
    key_path = os.path.join(data_dir, ".secret_key")
    
    if os.path.exists(key_path):
        with open(key_path, "r") as f:
            return f.read().strip()
    
    # 3. Generate new key and save it
    new_key = secrets.token_urlsafe(64)
    try:
        os.makedirs(data_dir, exist_ok=True)
        with open(key_path, "w") as f:
            f.write(new_key)
    except Exception as e:
        print(f"Warning: Could not save secret key to {key_path}: {e}")
        return secrets.token_urlsafe(64)
        
    return new_key

SECRET_KEY = get_secret_key()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30 # 30 days default lifespan

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def authenticate_user(db: Session, username: str, password: str):
    user = db.query(DBUser).filter(DBUser.username == username).first()
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_user(db: Session, user_data: dict):
    username = user_data.get("username")
    if not username or db.query(DBUser).filter(DBUser.username == username).first():
        raise ValueError("User already exists")
    
    password = user_data.get("password")
    if not password or len(password.strip()) < 8:
        raise ValueError("Password must be at least 8 characters long")

    hashed = get_password_hash(password)
    is_admin = bool(user_data.get("is_admin", False))
    
    new_user = DBUser(username=username, hashed_password=hashed, is_admin=is_admin)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return User(username=new_user.username, is_admin=new_user.is_admin, requires_password_change=False)

def update_user_db(db: Session, username: str, updates: dict):
    user = db.query(DBUser).filter(DBUser.username == username).first()
    if not user:
        return None
        
    # Strictly allow only valid user updates
    if "password" in updates and updates["password"]:
        new_password = updates["password"]
        if len(new_password.strip()) < 8:
            raise ValueError("Password must be at least 8 characters long")
        user.hashed_password = get_password_hash(new_password)
        
    if "is_admin" in updates:
        # Prevent removing admin rights from the default admin user
        if user.username == "admin" and not updates["is_admin"]:
            pass
        else:
            user.is_admin = bool(updates["is_admin"])

    db.commit()
    db.refresh(user)
    
    needs_change = False
    if user.username == "admin" and verify_password("admin", user.hashed_password):
        needs_change = True
        
    return User(username=user.username, is_admin=user.is_admin, requires_password_change=needs_change)

def delete_user_db(db: Session, username: str) -> bool:
    if username == "admin":
        return False
    user = db.query(DBUser).filter(DBUser.username == username).first()
    if user:
        db.delete(user)
        db.commit()
        return True
    return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=15)
    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(DBUser).filter(DBUser.username == username).first()
    if user is None:
        raise credentials_exception
        
    needs_change = False
    if user.username == "admin" and verify_password("admin", user.hashed_password):
        needs_change = True
        
    return User(username=user.username, is_admin=user.is_admin, requires_password_change=needs_change)

def get_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Ensures that users who still have the default password are locked down
    until they complete their initial password change.
    """
    if current_user.requires_password_change:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Default admin password must be changed before accessing application resources."
        )
    return current_user
