/* jshint esversion: 6, node: true */

'use strict';

const lib = require('../index.js'),
      SCAN_NAME = 'targettype';

function getTargetTypeName(t) {
  if (t === 'hosted') return 'HostedTarget';
  if (t === 'http') return 'HttpTargetConnection';
  if (t === 'local') return 'LocalTargetConnection';
  if (t === 'node') return 'ScriptConnection';
  return 'unknown';
}

/*
* Accepts org, an targetType (node, hosted, http, local), and a verboseOut
* function.  Returns a function that accepts (name,revision) and scans the proxy
* revision for a target endpoint of the specified type.
**/
function getRevisionScanner(org, targetType, verboseOut) {

  let isMatch = (t) =>
    (t.connection.connectionType == 'hostedTarget' && targetType == 'hosted') ||
    (t.connection.connectionType == 'scriptConnection' && targetType == 'node') ||
    (t.connection.connectionType == 'httpConnection' && targetType == 'http') ||
    (t.connection.connectionType == 'localTargetConnection' && targetType == 'local');

  function scanRevision({name, revision}) {
    function oneTarget(target) {
      return org.proxies.getTarget({name, revision, target})
        .then( t => (isMatch(t)) ? target: null);
    }

    function processTargets(targets) {
      return targets.reduce(lib.makeReducer(oneTarget), Promise.resolve([]))
        .then ( matched => {
          matched = matched.filter( item => !!item );
          return (matched.length === 0) ? null :
            {name, revision, targets:matched, scan:'target type ' + getTargetTypeName(targetType)};
        });
    }

    // if (verboseOut) {
    //   verboseOut('looking at:' + name + ' r' + revision);
    // }
    return org.proxies.getTargets({name,revision})
      .then(processTargets);
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  noarg : false,
  description : 'proxy with a specified target type (hosted, http, local, script)',
  getScanner : getRevisionScanner

};
