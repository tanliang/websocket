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
var debug = true;

/**
 * Create server with http module and weiterreiche the
 * instance to websocket module
 */
var httpd = http.createServer(function(request, response) {
    // process HTTP request. Since we're writing just WebSockets server
    // we don't have to implement anything.
});
httpd.listen('8078', '127.0.0.1', function(){});

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
                    console.log('new client: ' + uid);
                    // store information about pipe!
                    _pipes[packet.uid] = {
                        connection: connection,
                        interval: null,
                    	md5_id: null,
                    	name: null,
                    	level: null
                    };
                    var login = new auth(packet);
                	login.buyer(_login);
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
        	login.admin(_login);
        	break;
        default:
        	if (_users[packet.data.to] == undefined && _admin == null) {
        		_echo(connection, {route: "message", res: null});
        	}
        	
        	if (_admin != null) {
            	var data = packet.data;
        		if (_users[_admin] != uid) {
            		var conn = _pipes[_users[_admin]].connection;
            		if (_pipes[_users[data.from]].level != "buyer") {
                		data.from = packet.data.to;
                		data.to = packet.data.from;
            		}
            		_echo(conn, data);
        		} else {
        			packet.data.name = _pipes[_users[_admin]].name;
        			if (_users[data.from] != undefined) {
                		var conn = _pipes[_users[data.from]].connection;
                		data.from = packet.data.to;
            			data.name = packet.data.name
                		data.to = packet.data.from;
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
		_users[md5_id] = uid
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
    	
		if (level == "admin") {
			if (_admin != null) {
				var data = {
						route: "message",
						from: md5_id,
						name: name,
						to: _admin,		// to self, using alert
						msg: name+"login, you been kicked off."
					};
				_echo(_pipes[_admin].connection, data);
			}
			_admin = md5_id;
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
        console.log('connection closed by client with uid = ' + uid);

        for (pipe in _pipes) {
            if (pipe == uid) {
                if (_pipes[pipe]['interval'] != null) {
                    clearTimeout(_pipes[pipe]['interval']);
                }
                if (_admin == _pipes[pipe].md5_id) {
                	_admin = null;
                }
                delete _users[_pipes[pipe].md5_id];
                delete _pipes[pipe];
            }
        }
    });
});