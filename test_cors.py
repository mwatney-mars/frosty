import requests

res = requests.options("http://127.0.0.1:8000/api/devices/test", headers={
    "Origin": "https://frosty.mwatney.com",
    "Access-Control-Request-Method": "PATCH",
    "Access-Control-Request-Headers": "authorization,content-type"
})
print("Status:", res.status_code)
print("Headers:", res.headers)
