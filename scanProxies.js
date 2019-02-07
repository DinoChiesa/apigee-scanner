#! /usr/local/bin/node
/*jslint node:true, esversion:6 */
// scanProxies.js
// ------------------------------------------------------------------
//
// In Apigee Edge, scan all proxies for a specific condition, eg, proxies that
// refer to a specified vhost, or proxies with a name that matches a regex. This
// can be helpful in enforcing compliance rules: eg, proxies must not listen on
// the the 'default' (insecure) vhost , or proxies must have a name that
// conforms to a specific pattern.
//
// Copyright 2017-2019 Google LLC.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// last saved: <2019-February-06 17:26:56>

const edgejs = require('apigee-edge-js'),
      Getopt = require('node-getopt'),
      common = edgejs.utility,
      apigeeEdge = edgejs.edge,
      sprintf = require('sprintf-js').sprintf,
      lib = require('./lib/index.js'),
      scanners = lib.loadScanners(),
      version = '20190206-1726';

var optionsList = common.commonOptions.concat([
      ['q' , 'quiet', 'Optional. be quiet.'],
      ['d' , 'deployed', 'Optional. restrict the scan to revisions of proxies that are deployed.'],
      ['L' , 'list', 'Optional. list the available scanners.']
    ]);

// ========================================================================================

function listScanners(scanners) {
  scanners.forEach( scanner => {
    let usage = '--' + scanner.option;
    if ( ! scanner.noarg) { usage += ' ARG'; }
    console.log(sprintf('  %-18s %s', usage, scanner.description));
  });
}

function getRevisionScanners(org, scannerPlugins) {
  return scannerPlugins
    .filter( plugin => plugin.type == 'revision')
    .map( plugin => plugin.getScanner(org,
                                      opt.options[plugin.option],
                                      (opt.options.verbose)?common.logWrite:null));
}

function getProxyScanners(org, scannerPlugins) {
  return scannerPlugins
    .filter( plugin => plugin.type == 'proxy')
    .map( plugin => plugin.getScanner(org,
                                      opt.options[plugin.option],
                                      (opt.options.verbose)?common.logWrite:null));
}

// add the dynamically-loaded scanners into the optionsList
scanners.forEach( scanner => {
  var usage = scanner.option;
  if ( ! scanner.noarg) { usage += '=ARG'; }
  var newOption = ['', usage, scanner.description];
  optionsList.push(newOption);
});

const getopt = new Getopt(optionsList).bindHelp();

// process.argv array starts with 'node' and 'scriptname.js'
var opt = getopt.parse(process.argv.slice(2));

if ( ! opt.options.quiet) {
  console.log(
    'Apigee Edge proxy scanner tool, version: ' + version + '\n' +
      'Node.js ' + process.version + '\n');
}

// ========================================================================================

if (opt.options.list) {
  console.log('Scanners:');
  listScanners(scanners);
  process.exit(1);
}

let activePlugins = scanners.filter( scanner => opt.options[scanner.option]);
if (activePlugins.length == 0) {
  console.log('You have not specified any scanners.');
  console.log('Try one or more of the following:');
  listScanners(scanners);
  process.exit(1);
}

common.verifyCommonRequiredParameters(opt.options, getopt);

var options = {
      mgmtServer: opt.options.mgmtserver,
      org : opt.options.org,
      user: opt.options.username,
      password: opt.options.password,
      no_token: opt.options.notoken,
      verbosity: opt.options.verbose || 0
    };

apigeeEdge.connect(options)
  .then ( org => {
    let revisionScanners = getRevisionScanners(org, activePlugins);
    let proxyScanners = getProxyScanners(org, activePlugins);

    var p = (opt.options.deployed) ?
      org.proxies.getDeployments()
      .then( result => {
        // transform the result into a single array of name,revision tuples
        let transformed = [];
        result.environment.forEach( e => {
          e.aPIProxy.forEach( proxy => {
            proxy.revision.forEach( r => {
              if (transformed.findIndex( t =>  t.name === proxy.name && t.revision === r.name) == -1) {
                transformed.push({name:proxy.name, revision:r.name});
              }
            });
          });
        });
        return transformed;
      }) :
    org.proxies.get()
      .then( result => result.map( x => { return {name: x}; } ));

    p = p.then( proxySet => {
      // If looking at all proxies, proxySet is an array of {proxyname}.
      // OR, if looking at deployed proxies, proxySet is an array of {proxyname, revision}

      function oneProxy(tuple) {
        // EITHER:
        // tuple = {name,revision}, in which case we want to scan a single revision
        // OR
        // tuple = {name} and proxyDefn.revision is an array of revisions,
        // in which case we want to scan an array of revisions.

        var proxyDefn;
        function examineOneProxy(result) {
          proxyDefn = result; // save this for use in next fn
          return proxyScanners
            .map( oneScanner => oneScanner(result) )
            .reduce( (p, item) => p.then( async a => a.concat(await item) ) , Promise.resolve([]));
        }

        function examineRevisions(interimResults) {
          let revisionArray = (tuple.revision) ? [tuple.revision] : proxyDefn.revision;
          let nameRevPairs = revisionArray.map( x => { return { name: tuple.name, revision: x}; });

          // a 2-d reduce: applying N scanners to M revisions.
          return revisionScanners
            .map(lib.makeReducer)
            .map( x => nameRevPairs.reduce(x, Promise.resolve([]) ) )
            .reduce( (p, item) => p.then( async a => a.concat(await item) ) , Promise.resolve([]))
            .then( results => interimResults.concat(results));
        }

        return org.proxies.get({name:tuple.name})
          .then(examineOneProxy)
          .then(examineRevisions);
      }

      // apply the scans on each of the proxies in the set
      proxySet
        .reduce(lib.makeReducer(oneProxy), Promise.resolve([]))
        .then( allresults => {
          allresults = allresults
            .reduce( (a, b) => a.concat(b), []) // flatten the 2-D array
            .filter( item => !!item );
          console.log(JSON.stringify(allresults, null, 2));
        });

    });
  })
  .catch( e => { console.error('error: ' + e.error);} );
