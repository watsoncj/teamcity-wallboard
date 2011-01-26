var sys = require('sys');
var Mustache = require('./lib/mustache');

var array = new Array();
array.push({name: 'bob'});
array.push({name: 'john'});

var json = { status: 'success', names: array };

sys.puts(json.names[0].name);
sys.puts(json.names[1].name);

sys.puts(Mustache.to_html("{{status}}{{#names}}{{name}}{{/names}}", json));
