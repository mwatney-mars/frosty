curl -v -X OPTIONS http://127.0.0.1:8000/api/devices/test \
  -H "Origin: https://frosty.mwatney.com" \
  -H "Access-Control-Request-Method: PATCH" \
  -H "Access-Control-Request-Headers: authorization,content-type"
