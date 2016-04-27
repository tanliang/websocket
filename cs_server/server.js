/**
 * get arguments
 */
var program   = require('commander'); 

program.version('0.0.1').usage('[options] [value ...]')  
.option('-h, --host <string>', 'bind with a address.')  
.option('-p, --port <string>', 'listen to a port.')  
.option('-d, --debug <n>', 'output log. 0=no, 1=yes(default)', parseInt, 1)  

program.parse(process.argv)

/**
 * load modules
 */
var websocket = require('websocket').server;
var crypto    = require('crypto');
var http      = require('http');
var auth      = require('./auth');

/**
 * setup
 */
const WS_ID = 'WebSocketPipe';
var debug = program.debug;

/**
 * Create server with http module and weiterreiche the
 * instance to websocket module
 */
var httpd = http.createServer(function(request, response) {
    // process HTTP request. Since we're writing just WebSockets server
    // we don't have to implement anything.
});

var host = program.host || '127.0.0.1';
var port = program.port || '8078';
httpd.listen(port, host, function(){});

// Create the WebSocket-Server
wsServer = new websocket({
    httpServer: httpd
});

var _admin = null;			// admin = md5_id
var _users = {};
var _pipes = {};

// WebSocket server listen on ...
wsServer.on('request', function(request) {

    var connection = request.accept(null, request.origin);
    var packet;
    var uid;	// session id

    // This is the most important callback for us, we'll handle
    // all messages from users here.
    connection.on('message', function(message) {
    	if (message.type === 'utf8') {
	        if (debug) {
	            console.log(">>>>>>>> in >>>>>>>>");
	            console.log(message);
	        }
	        _run(message);
    	}
    });
    
    var _run = function(message) {
        try {
            // get package as JSON
            packet = JSON.parse(message.utf8Data);
            if (packet.type == WS_ID) {
                switch (packet.action) {
                case "startup":
                	uid = packet.uid
                	if (debug) {
                        console.log('new client: ' + uid);
                	}
                    // store information about pipe!
                    _pipes[packet.uid] = {
                        connection: connection,
                        interval: null,
                    	md5_id: null,
                    	name: null,
                    	level: null
                    };
                    var login = new auth(packet);
                	login.ssapi(_login);
                	break;
                case 'shutdown':
                	delete _users[_pipes[packet.uid].md5_id];
                    delete _pipes[packet.uid];
                    break;
                case 'message':
                	_route(packet);
                    break;
                }
            }
        } catch (e) {
        	console.log(e.name + ': ' + e.message);
        };
    };
    
    var _route = function(packet) {
    	switch (packet.data.route) {
    	case 'ping':
    		 _pipes[packet.uid]['interval'] = setInterval(_ping, 10000, connection, packet.uid);
    		 break;
    	case 'login':
        	var login = new auth(packet);
        	login.ssbuy(_login);
        	break;
        default:
        	if (_users[packet.data.to] == undefined && _admin == null) {
        		_echo(connection, {route: "message", res: null});
        	}
        	
        	packet.data.tab = packet.data.name;
        	
        	if (_admin != null) {
        		if (_users[_admin] != uid) {
                	// seller(from) send to admin
            		var conn = _pipes[_users[_admin]].connection;
            		var data = packet.data;
            		if (_pipes[_users[packet.data.from]].level != "buyer") {
            			data = {
            				from: packet.data.to,
            				name: packet.data.name,
            				tab: _pipes[_users[packet.data.to]].name,
            				to: packet.data.from,            			
            				msg: packet.data.msg            			
            			}
            		}
            		_echo(conn, data);
        		} else {
                	// admin send to seller(from)
        			if (_users[packet.data.from] != undefined) {
                		var conn = _pipes[_users[packet.data.from]].connection;
                		var data = {
                			from: packet.data.to,
                			name: _pipes[_users[_admin]].name,
                			tab: packet.data.name,
                			to: packet.data.from,            			
            				msg: packet.data.msg  
                		}
                		_echo(conn, data);
        			}
        		}
        	}
        	
        	if (_users[packet.data.to] != undefined) {
        		var conn = _pipes[_users[packet.data.to]].connection;
        		_echo(conn, packet.data);
        	}
    		
        	break;
        }
    };

    var _login = function(level, md5_id, name, uid) {
    	if (md5_id == null) {
    		_echo(connection, {route: "login", res: null});
    	} else {
			_pipes[uid].md5_id = md5_id;
			_pipes[uid].name = name;
			_pipes[uid].level = level;
			var res = {
				route: "login",
				res: {
					level: level, 
					from: md5_id, 
					name: name
				}
			};
	    	_echo(connection, res);
	    	
	    	var md5_prev = md5_id;
			if (level == "admin") {
				md5_prev = _admin;
				_admin = md5_id;
			}
	    	
	    	if (_users[md5_prev] != undefined) {
	    		var prev = _pipes[_users[md5_prev]];
				var data = {
						route: "message",
						from: prev.md5_id,	// from self, using alert
						name: name,
						to: md5_id,		
						msg: name+"logined from "+connection.remoteAddress+"。you been kicked out."
					};
				_echo(prev.connection, data);
	    	}
			_users[md5_id] = uid;
    	}
    };

    /**
     * sends a pong to given id + connection
     */
    var _ping = function(connection, uid) {

        connection.send('{"type": "'+WS_ID+'", "uid": "' + uid + '", "action": "ping"}');
    };

    /**
     * simple echo for input
     */
    var _echo = function(connection, data) {
    	var message = 
            '{"type": "'+WS_ID+'", "action": "message", "uid": "'+packet.uid+'", "data": '+JSON.stringify(data)+'}';
        connection.send(message);
        if (debug) {
            console.log("<<<<< out <<<<<<<");
            console.log(message);
        }
    };

    /**
     * dummy event
     */
    connection.on('close', function(connection) {
        //
    	if (debug) {
            console.log('connection closed by client with uid = ' + uid);
    	}

        for (pipe in _pipes) {
            if (pipe == uid) {
                if (_pipes[pipe]['interval'] != null) {
                    clearTimeout(_pipes[pipe]['interval']);
                }
                if (_admin == _pipes[pipe].md5_id) {
                	_admin = null;
                }
                // in case of user login repeatly
                if (_users[_pipes[pipe].md5_id] == uid) {
                    delete _users[_pipes[pipe].md5_id];
                }
                delete _pipes[pipe];
            }
        }
    });
});