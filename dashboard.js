var crypto = require('crypto');
var http = require('http');
var sys = require('sys');
var fs = require('fs')
var xml = require('./lib/node-xml');
var Mustache = require('./lib/mustache');

var userEmail = {'hjerger': 'watsoncj@gmail.com', 'jeff': 'jstano@unifocus.com'};

var headers = {'host': 'den-dev-01', 'Authorization': 'Basic Y3dhdHNvbjpMb2NrbncwZA==', 'Accept': 'application/json'};
var client = http.createClient(8111, 'den-dev-01');

http.createServer(function (req, res) {
   res.writeHead(200, {'Content-Type': 'text/plain'});
   var request = client.request('GET', '/httpAuth/app/rest/builds/?locator=id:bt2', headers);
   request.end();
   handleResponse(request, function(content) {
      var build = JSON.parse(content).build[0];

      // got build id now fetch status info
      var request = client.request('GET', build.href, headers);
      request.end();
      handleResponse(request, function(content)
      {
         var buildData = JSON.parse(content);
         var buildName = buildData.buildType.name;
         var status = buildData.status;
         var statusText = buildData.statusText;
         var changes = buildData.changes;
         var request = client.request('GET', changes.href, headers);
         request.end();
         handleResponse(request, function(content)
         {
            var changeData = JSON.parse(content);

            var view = {
               buildName: buildName,
               buildStatus: status,
               buildStatusText: statusText,
               changeCount: changes.count + (changes.count==1 ? ' change' : ' changes'),
               changes: Array()
            };

            var changes = changeData.change;
            if (!changes.length)
              changes = Array(changeData.change);
            sys.puts(changes.length);
            for(var change = 0; change<changes.length; change++) {
               var href = changeData.change[change]['@href'];
               var request = client.request('GET', href, headers);

               request.end();
               handleResponse(request, function(content) {
                  var changeDetails = JSON.parse(content);

                  var email = userEmail[changeDetails.username];
                  var avatar = '';
                  if (email) {
                     var md5 = crypto.createHash('md5').update(email).digest('hex');
                     avatar = 'http://www.gravatar.com/avatar/' + md5;
                  } 
                  var name = changeDetails.name;
                  if(!name)
                     name =  changeDetails.userName;

                  view.changes[change] = {
                     name: name,
                     comment: changeDetails.comment,
                     avatar: avatar
                  };

                  if (change == changes.length - 1) {
                     fs.readFile("./template.html", function (err, template) {
                        if (err) throw err;
                        res.writeHeader(200, {'Content-Type': 'text/html'});
                        res.write(Mustache.to_html(""+template, view));
                        res.end();
                     });
                  }
               });
            }
         });
         // TODO: fetch change details
      });
   });
}).listen(8080, '127.0.0.1');
console.log('Server running at http://localhost:8080');

function handleResponse(request, func)
{
   request.on('response', function (response) {
      var bigChunk = '';
      response.setEncoding('utf8');
      response.on('data', function (chunk) {
         bigChunk += chunk;
      });
      response.on('end', function() {
         func.call(this, bigChunk);
      });
   });
}
