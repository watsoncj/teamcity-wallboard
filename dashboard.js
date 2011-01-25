var http = require('http');
var sys = require('sys');
var posix = require('posix')
var xml = require('./lib/node-xml');
var Mustache = require('./lib/mustache');

sys.puts(Mustache);

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
         sys.puts(buildName + ' ' + status + ' '+ statusText);


         var view = {
            buildName: buildName,
            buildStatus: status,
            buildStatusText: statusText
         };

         posix.cat("./template.html").addCallback(function(template) {
            res.sendHeader(200, {'Content-Type': 'text/html'})
            res.sendBody(Mustache.to_html(template, action.view))
            res.finish()
         })
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
