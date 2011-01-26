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
//var client = http.createClient(8111, 'den-dev-01');
var client = http.createClient(33333, 'localhost');

http.createServer(function (req, res) {
   res.writeHead(200, {'Content-Type': 'text/plain'});
   var request = client.request('GET', '/httpAuth/app/rest/builds/?buildType=id:bt2', headers);
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
         var buildStatus = buildData.status;
         var statusText = buildData.statusText;
         var changes = buildData.changes;

         var request = client.request('GET', changes.href, headers);
         request.end();
         handleResponse(request, function(content)
         {
            var changeData = JSON.parse(content);
            //var changes = changeData.change;
            var changes = changeData['change'];
//            var changeCount = changes.count + (changes.count==1 ? ' change' : ' changes');
            var changeCount = changeData['@count'];

            var view = {
               buildName: buildName,
               buildStatus: buildStatus,
               buildStatusText: statusText,
               changeCount: changeCount
            };

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
sys.puts(JSON.stringify(parsedChanges));
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

                  checkComplete(res, view, changeDetails);
              });
            }
         });
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

function checkComplete(res, view, changeDetails)
{
sys.puts(view.changeCount);
   // if any of the changes in the view are null, then we are still waiting for some of the callbacks to complete
   for (var c=0; c<view.changeCount; c++) {
      sys.puts("change " + c + " of " + view.changeCount + " is " + changeDetails[c]);
      if(!changeDetails[c])
         return;
   }

   var n1 = changeDetails[0].name;
   var c1 = changeDetails[0].comment;
   var a1 = changeDetails[0].avatar;

   var n2 = changeDetails[1].name;
   var c2 = changeDetails[1].comment;
   var a2 = changeDetails[1].avatar;

//   var n3 = changeDetails[2].name;
//   var c3 = changeDetails[2].comment;
//   var a3 = changeDetails[2].avatar;

   var finalView = {
      buildName: view.buildName,
      buildStatus: view.buildStatus,
      buildStatusText: view.buildStatusText,
      changeCount: view.changeCount,
      changes: [{name: n1, comment: c1, avatar: a1},{name: n2, comment: c2, avatar: a2}],
      changes2: [{name: 'why',avatar: "http://www.gravatar.com/avatar/cbebdf1cdbb5aefd1a023f524d04364c"},{name: 'dont you' },{name: 'work?'} ]
   };

   sys.puts();
   sys.puts(JSON.stringify(view));
   sys.puts();
   sys.puts(JSON.stringify(finalView));

   // all callbacks have completed, render view
   fs.readFile("./template.html", function (err, template) {
      if (err) throw err;
      res.writeHeader(200, {'Content-Type': 'text/html'});
      res.write(Mustache.to_html(""+template, finalView).replace(/#newline#/g,'<br/>'));
      res.end();
   });
}
