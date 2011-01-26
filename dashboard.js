var crypto = require('crypto');
var http = require('http');
var sys = require('sys');
var fs = require('fs')
var xml = require('./lib/node-xml');
var Mustache = require('./lib/mustache');

var userEmail = {
   'cwatson': 'watsoncj@gmail.com', 
   'hjerger': 'hjerger@unifocus.com', 
   'jeff': 'jstano@unifocus.com',
   'belder': 'belder@unifocus.com'
};

var headers = {'host': 'den-dev-01', 'Authorization': 'Basic Y3dhdHNvbjpMb2NrbncwZA==', 'Accept': 'application/json'};
var client = http.createClient(8111, 'den-dev-01');
//var client = http.createClient(33333, 'localhost');


http.createServer(function (req, res) {
   var model = {
      builds: new Array(),
      buildCount: 0
   };
   //sys.puts(JSON.stringify(req.headers, null, '  '));
   //sys.puts(req.url);
   if (req.url!='/')
   {
      res.writeHead('400');
      return;
   }
   res.writeHead(200, {'Content-Type': 'text/plain'});
   //var request = client.request('GET', '/httpAuth/app/rest/builds/?buildType=id:bt2&locator=running:true', headers);
   fetchBuilds(res, req, '/httpAuth/app/rest/builds/?buildType=id:bt2&locator=running:true', model);
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

function fetchBuilds(res, req, url, model)
{
   var request = client.request('GET', url, headers);
   request.end();
   handleResponse(request, function(content) {
      var parsedBuild = JSON.parse(content)
      // if no build found just return
      if(!parsedBuild.build) {
        fetchBuilds(res, req, '/httpAuth/app/rest/builds/?buildType=id:bt2', model);
        return;
      }
      var build = parsedBuild.build[0];
      if(!build)
        build = parsedBuild.build;

      model.buildCount++;
      // got build id now fetch status info
      var request = client.request('GET', build.href, headers);
      request.end();
      handleResponse(request, function(content)
      {
         var buildData = JSON.parse(content);
      //sys.puts(JSON.stringify(buildData, null, '  ' ));
         var running = buildData.running;
         var buildName = buildData.buildType.name;
         var buildStatus = running ? 'RUNNING' : buildData.status;
         var percentageComplete;
         if (running)
           percentageComplete = buildData['running-info'].percentageComplete;

         var statusText = buildData.statusText;
         var changes = buildData.changes;

         var request = client.request('GET', changes.href, headers);
         request.end();
         handleResponse(request, function(content)
         {
         //sys.puts(content);
            var changeData = JSON.parse(content);
            var changeCount = changeData['@count'];

            var build = {
               buildId: buildData.id,
               buildName: buildName,
               buildStatus: buildStatus,
               buildStatusText: statusText,
               changeCount: changeCount,
               percentageComplete: percentageComplete,
               running: running,
               isRunning: function() {
                  return running;
               }
            };

            fetchChangeDetails(res, req, model, build, changeData);

         });
      });
   });

}

function fetchChangeDetails(res, req, model, build, changeData)
{
   var changes = changeData['change'];
   // handle issue where TeamCity doesn't return a single change as an array
   if (!changes.length)
     changes = new Array(changeData.change);
   var changeDetails = new Array();
   for(var i = 0; i<changes.length; i++) {
      var href = changes[i]['@href'];
      var request = client.request('GET', href, headers);

      request.end();
      handleResponse(request, function(content) {
         var parsedChanges = JSON.parse(content);

         var email = userEmail[parsedChanges.user.username];
         var avatar = 'http://www.gravatar.com/avatar/';
         if (email) {
            var md5 = crypto.createHash('md5').update(email).digest('hex');
            avatar += md5;
         } 
         var name = parsedChanges.user.name;
         if(!name)
            name =  parsedChanges.user.username;

         // \n chars will break the JSON. We do however want to preserve them
         var comment = parsedChanges.comment.replace(/\n/g,'#newline#');

         changeDetails.push({
            name: name,
            comment: comment,
            avatar: avatar
         });

         build.changes = changeDetails;

         // check if this is the last change of the build before adding the build to the model
         if (changeDetails.length < build.changeCount)
            return;

         model.builds.push(build);

         checkComplete(res, model, changeDetails);
     });
   }
}

function checkComplete(res, model, changeDetails)
{
   // ensure all builds have been populated
   if(model.builds.length<model.buildCount)
      return;

   // all callbacks have completed, render view
   //sys.puts();
   //sys.puts('model');
   //sys.puts(JSON.stringify(model, null, '  '));
   fs.readFile("./template.html", function (err, template) {
      if (err) throw err;
      res.writeHeader(200, {'Content-Type': 'text/html'});
      res.write(Mustache.to_html(""+template, model).replace(/#newline#/g,'<br/>'));
      res.end();
   });
}
