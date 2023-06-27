#! /usr/local/bin/node
/* jslint node:true, esversion:9, strict:implied */
// scanProxies.js
// ------------------------------------------------------------------
//
// In an Apigee organization, scan all proxies for a specific condition, eg,
// proxies that refer to a specified vhost, or proxies with a name that matches
// a regex. This can be helpful in enforcing compliance rules: eg, proxies must
// not listen on the the 'default' (insecure) vhost, or proxies must have a name
// that conforms to a specific pattern.
//
// Copyright © 2017-2023 Google LLC.
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
// last saved: <2023-June-26 17:32:25>

const apigeejs = require('apigee-edge-js'),
      Getopt   = require('node-getopt'),
      util     = require('util'),
      path     = require('path'),
      fs       = require('fs'),
      tmp      = require('tmp-promise'),
      common   = apigeejs.utility,
      apigee   = apigeejs.apigee,
      sprintf  = require('sprintf-js').sprintf,
      AdmZip   = require('adm-zip'),
      lib      = require('./lib/index.js'),
      scanners = lib.loadScanners(),
      version  = '20230626-1729';

let optionsList = common.commonOptions.concat([
      ['q' , 'quiet', 'Optional. be quiet.'],
      ['d' , 'deployed', 'Optional. restrict the scan to revisions of proxies that are deployed.'],
      ['L' , 'list', 'Optional. list the available scanners.'],
      ['e' , 'environment=ARG', 'Optional. Use with the --deployed flag.'],
      ['' , 'latestrevision', 'Optional. scan only the latest revision of each proxy.'],
      ['' , 'namepattern=ARG', 'Optional. scan only proxies with a name matching the regex.']
    ]);

// ========================================================================================

function listScanners(scanners) {
  scanners.forEach( scanner => {
    let usage = '--' + scanner.option;
    if ( ! scanner.noarg) { usage += ' ARG'; }
    console.log(sprintf('  %-18s %s', usage, scanner.description));
  });
}

const getRevisionScanners =
  (org, scannerPlugins) =>
  scannerPlugins
    .filter( plugin => plugin.type == 'revision')
    .map( plugin => plugin.getScanner(org,
                                      opt.options[plugin.option],
                                      (opt.options.verbose)?common.logWrite:null));

const getProxyScanners =
  (org, scannerPlugins) =>
  scannerPlugins
    .filter( plugin => plugin.type == 'proxy')
    .map( plugin => plugin.getScanner(org,
                                      opt.options[plugin.option],
                                      (opt.options.verbose)?common.logWrite:null));

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
    'Apigee proxy scanner tool, version: ' + version + '\n' +
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

if (opt.options.apigeex && opt.options.deployed && !opt.options.environment) {
  console.log('With --apigeex, you must specify --environment when you also specify --deployed.');
  getopt.showHelp();
  process.exit(1);
}

common.verifyCommonRequiredParameters(opt.options, getopt);
var options = common.optToOptions(opt);

apigee.connect(options)
  .then ( org => {
    let revisionScanners = getRevisionScanners(org, activePlugins);
    let proxyScanners = getProxyScanners(org, activePlugins);

    let p = (opt.options.deployed) ?
      org.proxies.getDeployments({environment:opt.options.environment})
      .then( result => {
        // transform the result into a flat array of name,revision tuples
        //console.log('result: ' + util.format(result));
        // gaambo: {  deployments: [ { environment: 'test1', apiProxy: 'httpbin-v0', revision: '1', basePath: '/'}..] }
        // edge with environment: { aPIProxy: [ { name: 'httpbin-v0', revision: ['1'] }..] }
        // edge without environment: { environment: [ {name: 'e1', aPIProxy: [ { name: 'httpbin-v0', revision: ['1'] }...] }...] }

        if (result.deployments) {
          return result.deployments.map( d => ({name:d.apiProxy, revision:d.revision }));
        }
        if (result.aPIProxy) {
          return result.aPIProxy.map( d => ({name:d.name, revision:d.revision.slice(-1) }));
        }

        if ( ! result.environment) {
          throw new Error('missing environment');
        }
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
      .then( result => result.proxies? result.proxies : result.map( x => ({name: x}) ) ) ;

    if (opt.options.namepattern) {
      let re1 = new RegExp(opt.options.namepattern);
      p = p.then( proxySet => proxySet.filter(x => x.name.match(re1)));
    }

    //p = p.then( proxySet => (console.log(JSON.stringify(proxySet)), proxySet));


    p = p.then( proxySet => {
      // If looking at all proxies, proxySet is an array of {name: proxyname}.
      // OR, if looking at deployed proxies, proxySet is an array of {name:proxyname, revision}

      //console.log(JSON.stringify(proxySet));

      return tmp.dir({unsafeCleanup:true, prefix: 'scanProxies'}).then(tmpdir => {

        function oneProxy(tuple) {
          // EITHER:
          // tuple = {name,revision}, in which case we want to scan a single revision
          // OR
          // tuple = {name} and proxyDefn.revision is an array of revisions,
          // in which case we want to scan an array of revisions.

          // There are two kinds of scans: one that applies to the proxy
          // definition itself, and the other that applies to the proxy revision.
          // The proxy is pretty limited in what it stores: proxy name.  The
          // revision is what contains most of the interesting information that is
          // worthy of scanning.
          //console.log(`oneProxy(): ${util.format(tuple)}`);

          let proxyDefn;

          function getRevisionArray() {
            // console.log(`getRevisionArray(): tuple: ${util.format(tuple)}`);
            // console.log(`getRevisionArray(): proxyDefn: ${util.format(proxyDefn)}`);
            if (tuple.revision) {
              if (Array.isArray(tuple.revision)) {
                return [tuple.revision[0].name];
              }
              return [tuple.revision];
            }
            return proxyDefn.revision;
          }

          function examineOneProxy(result) {
            proxyDefn = result; // save this for use in next fn
            // console.log(`examineOneProxy(): result: ${util.format(result)}`);
            return proxyScanners
              .map( oneScanner => oneScanner(result) )
              .reduce( (p, item) => p.then( async a => a.concat(await item) ) , Promise.resolve([]));
          }

          async function examineRevisions(interimResults) {
            let revisionArray = getRevisionArray();
            // console.log(`examineRevisions(): a1: ${util.format(revisionArray)}`);
            revisionArray = revisionArray
              .map(a => Number(a))
              .sort((a, b) => { if (a>b) return 1; if (b>a) return -1; return 0;});
            if (opt.options.latestrevision) {
              revisionArray = revisionArray.slice(-1);
            }
            //console.log(`examineRevisions(): a2: ${util.format(revisionArray)}`);

            let nameRevTuples =
              await revisionArray
              .reduce( (p, x) => p.then( async a => {
                return org.proxies.export({name:tuple.name, revision:x})
                  .then(({filename, buffer}) => {
                    let pathOfZip = path.join(tmpdir.path, filename);
                    // console.log(`looking at rev ${x}`);
                    let pathOfUnzippedBundle = path.join(tmpdir.path, `proxy-${tuple.name}-r${x}`);
                    fs.writeFileSync(pathOfZip, buffer);
                    var zip = new AdmZip(pathOfZip);
                    zip.extractAllTo(pathOfUnzippedBundle, false);
                    return a.concat({ name: tuple.name, revision: x, bundleDir:pathOfUnzippedBundle});
                  });
              }), Promise.resolve([]));

            // a 2-d reduce: applying N scanners to M revisions.
            return revisionScanners
              .map(lib.makeReducer) // turn each scanner into a reducer
              .map( x => nameRevTuples.reduce(x, Promise.resolve([]) ) )
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
          })
          .then(() => tmpdir.cleanup());
      });
    });
  })
  .catch( e => { console.error('error: ' + e.stack);} );
