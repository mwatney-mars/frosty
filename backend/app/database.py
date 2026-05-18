import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import bcrypt

# Support a DB_PATH env var, defaulting to local frosty.db
DB_PATH = os.getenv("DB_PATH", "./frosty.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class DBUser(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False)

class DBDeviceName(Base):
    __tablename__ = "device_names"

    mac = Column(String, primary_key=True, index=True)
    name = Column(String)

def get_all_saved_devices(db):
    return db.query(DBDeviceName).all()

def add_saved_device(db, mac, name):
    device = db.query(DBDeviceName).filter(DBDeviceName.mac == mac).first()
    if device:
        device.name = name
    else:
        device = DBDeviceName(mac=mac, name=name)
        db.add(device)
    db.commit()
    return device

def delete_saved_device(db, mac):
    device = db.query(DBDeviceName).filter(DBDeviceName.mac == mac).first()
    if device:
        db.delete(device)
        db.commit()
        return True
    return False

def init_db():
    # Ensure the directory exists if a custom path is provided
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Create default admin if not exists
    admin = db.query(DBUser).filter(DBUser.username == "admin").first()
    if not admin:
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(b"admin", salt).decode('utf-8')
        new_admin = DBUser(username="admin", hashed_password=hashed, is_admin=True)
        db.add(new_admin)
        db.commit()
    db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
