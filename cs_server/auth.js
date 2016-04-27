var request = require('request');
var crypto  = require('crypto');

function Auth(packet){
	this.packet = packet;
}

Auth.prototype.admin = function(callback) {
	var api_user = "xxx";
	var api_pass = "yyy";
    var username = this.packet.data.username;
    var password = this.packet.data.password;
    var uid = this.packet.uid;
    
    var url = "http://admin.example.com";
	request.post({url:url+"/?route=api/login", form: {username: api_user, password: api_pass}}, 
    		function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var res = JSON.parse(body);
            if (res.success) {
            	var j = request.jar();
            	var cookie = request.cookie('PHPSESSID='+res.cookie);
            	j.setCookie(cookie, url);
            	request.post({url: url+"/?route=api/user", jar: j, form: {username: username, password: password}}, function (error, response, body) {
                	//console.log(response);
            		var md5_id = null,
	        			level = "seller",
	        			name = null;
	                if (!error && response.statusCode == 200) {
	                	var res = JSON.parse(body);
	                    if (res.success == 1) {
	                    	var md5 = crypto.createHash("md5");
	                		md5_id  = md5.update(res.data.user_id).digest("hex");
	                		if (res.data.user_group_id == 12) {
	                			level = "admin";
	                		}
	                		name = res.data.fullname;
	                    }
	                }
	            	callback(level, md5_id, name, uid);
                });
            }
        }
    });
};

Auth.prototype.buyer = function(callback) {
    var token = this.packet.data;
    var uid = this.packet.uid;
    
    var url = "http://buyer.example.com";
	request({url:url+"/user/get/?token="+token}, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var res = JSON.parse(body);
            if (res.success) {
            	var name = res.data.nickname || "瘦友";
            	callback("buyer", res.data.md5_id, name, uid);
            }
        }
    });
};


module.exports = Auth;
