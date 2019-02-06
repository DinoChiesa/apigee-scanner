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
// last saved: <2019-February-05 18:05:37>

const edgejs = require('apigee-edge-js'),
      Getopt = require('node-getopt'),
      common = edgejs.utility,
      apigeeEdge = edgejs.edge,
      sprintf = require('sprintf-js').sprintf,
      lib = require('./lib/index.js'),
      scanners = lib.loadScanners(),
      version = '20190205-1805';

var optionsList = common.commonOptions.concat([
      ['q' , 'quiet', 'Optional. be quiet.'],
      ['d' , 'deployed', 'Optional. restrict scan to revisions of proxies that are deployed.'],
      ['L' , 'list', 'Optional. list the scanners available.']
    ]);

// ========================================================================================

function listScanners(scanners) {
  scanners.forEach( scanner => {
    let usage = '--' + scanner.option;
    if ( ! scanner.noarg) { usage += ' ARG'; }
    console.log(sprintf('  %-18s %s', usage, scanner.description));
  });
}

function getRevisionHandler(org, scannerPlugins) {
  let scanFunctions = scannerPlugins
    .filter( plugin => plugin.type == 'revision')
    .map( plugin => plugin.getScanner(org,
                                      opt.options[plugin.option],
                                      (opt.options.verbose)?common.logWrite:null));

  if (scanFunctions.length == 0) {
    // return no-op if no scan functions active
    return function(name) {
      return function(revision) {
        return Promise.resolve();
      };
    };
  }

  function scan(name) {
    return (revision, accumulator) => {
      //console.log('revisionIterator('+name + ',' + revision+')');
      function reducer(p, fn) {
        async function one() {
          try {
            let oneScanResult = await fn(name, revision);
            //console.log('** oneScanResult('+name + ',' + revision+'): ' + JSON.stringify(oneScanResult));
            return (oneScanResult) ? accumulator.concat(oneScanResult) : accumulator;
          }
          catch (e) {
            console.log(e.stack);
            process.exit(1);
          }
        }
        return p.then( one );
      }
      return scanFunctions.reduce( reducer, Promise.resolve([]));
    };
  }

  return scan;
}


function getProxyHandler(org, scannerPlugins) {
  let scanFunctions = scannerPlugins
    .filter( plugin => plugin.type == 'proxy')
    .map( plugin => plugin.getScanner(org,
                                      opt.options[plugin.option],
                                      (opt.options.verbose)?common.logWrite:null));
  if (scanFunctions.length == 0) {
    // return a no-op function if no scan functions active
    return function(name) {
      return Promise.resolve([]);
    };
  }

  async function scan(proxyDefn) {
    function reducer(p, fn) {
      async function one(interim) {
        let oneScanResult = await fn(proxyDefn);
        return (oneScanResult)? interim.concat(oneScanResult): interim;
      }
      return p.then( one );
    }
    return scanFunctions.reduce( reducer, Promise.resolve([]) );
  }

  return scan;
}

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
    let scanOneRevision = getRevisionHandler(org, activePlugins);
    let scanOneProxy = getProxyHandler(org, activePlugins);

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

    p = p.then( result => {
      // If looking at all proxies, result is an array of {proxyname}.
      // OR, if looking at deployed proxies, result is an array of {proxyname, revision}

      // for testing
      // result = result.filter( x => x.startsWith('sujnana'));
      // result = result.filter( (item, ix) => ix < 4);
      // console.log(' proxies: ' + JSON.stringify(result, null, 2));

      function oneProxy(tuple, accumulator) {
        async function examineOneProxy(result){
          let proxyScanResult = await scanOneProxy(result);
          if (proxyScanResult && proxyScanResult.length > 0) {
            accumulator = accumulator.concat(proxyScanResult);
          }
          return result;
        }

        // async function examineAllRevisions(proxyDefn) {
        //   let revResult = await lib.eachSeries(proxyDefn.revision, scanOneRevision(tuple.name));
        //   //console.log('revResult: ' + JSON.stringify(revResult));
        //   return accumulator.concat(revResult);
        // }
        //
        // async function examineOneRevision(result) {
        //   let fn = scanOneRevision(tuple.name);
        //   let revResult = await fn(tuple.revision, []);
        //   return accumulator.concat(revResult);
        // }

        async function examineOneOrMoreRevisions(proxyDefn) {
          let fn = scanOneRevision(tuple.name);
          var revResult;
          if (tuple.revision) { revResult = await fn(tuple.revision, []); }
          else {revResult = await lib.eachSeries(proxyDefn.revision, fn);}
          return accumulator.concat(revResult);
        }

        return org.proxies.get({name:tuple.name})
          .then(examineOneProxy)
          .then(examineOneOrMoreRevisions);
      }

      lib.eachSeries(result, oneProxy)
        .then( allresult => {
          allresult = allresult.filter( item => !!item );
          console.log(JSON.stringify(allresult, null, 2));
        });

    });
  })
  .catch( (e) => { console.error('error: ' + e.error);} );
