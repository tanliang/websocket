# websocket

a customer service **demo** with admin client(nw.js) && demo.html(jquery.websocket), build on node.js with websocket

 ![mind](https://github.com/tanliang/websocket/raw/master/all.png)
 
# cs_cleint

demo.html support by [jquery.websocket](https://github.com/clickalicious/jQuery.WebSocket). for example, http://xxx.com/demo.html?token=xxx&to=md5_id&msg=zzz

index.html need [nw.js](https://github.com/nwjs/nw.js). get sdk download, as say [win-x64](http://dl.nwjs.io/v0.14.1/nwjs-v0.14.1-win-x64.zip), unzip pack, run nw.exe. F12 for console debug.

# cs_server

developed on windows7 64bit, deployed on centos6.4

nohup node server.js -d 0 &

crontab -e

*/30 * * * * /var/cron/log_monitor.sh nohup.out
```bash
#!/bin/bash
err=`cat $1 |grep -C5 error`
if [ "$err" != "" ]; then
  echo "$err"|mail -s "`curl ifconfig.me` $1" tanliang@xxx.com
  cat /dev/null > $1
fi
```