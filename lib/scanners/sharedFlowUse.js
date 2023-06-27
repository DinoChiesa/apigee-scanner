/* jslint esversion: 9, node: true */

'use strict';

const fs = require('fs'),
      path = require('path'),
      Dom = require("@xmldom/xmldom").DOMParser,
      xpath = require("xpath"),
      SCAN_OPTION = 'sharedflowuse';

/*
* Accepts org, and a sharedFlowName, which can be a regular string or
* a regex, denoted by leading and trailing /. Returns a
* function that accepts {(name,revision,bundleDir)} and scans the exploded
* bundle for a FlowCallout policy to a sharedflow that matches: if name, exact
* match; if regex, regex match.
**/
function getRevisionScanner(org, sharedFlowName, verboseOut) {
  //console.log(`policyType.revisionScanner(): ${policyType}`);
  let isRegex = s => (s && s.startsWith('/') && s.endsWith('/'));

  let isMatch = (function (){
        if (isRegex(sharedFlowName)) {
          let regex = new RegExp(sharedFlowName.slice(1, -1));
          return (t) => t.match(regex);
        }
        // just a string match
        return (t) => (t == sharedFlowName);
      }());

  function scanRevision({name, revision, bundleDir}) {
    //console.log('bundleDir: ' + bundleDir);
    let policiesDir = path.join(bundleDir, 'apiproxy', 'policies');
    let dirExists = fs.existsSync(policiesDir);
    let policies = dirExists ? fs.readdirSync(policiesDir) : [];

    let check = policies
      .map(item => {
        let policyFilePath = path.join(policiesDir, item);
        let element = new Dom().parseFromString(
              fs.readFileSync(policyFilePath).toString()
            );
        let doc = xpath.select("/", element);

        if ( ! doc || !doc[0] || !doc[0].documentElement) {
          return null;
        }
        let policyType = doc[0].documentElement.tagName || "";
        if (policyType == 'FlowCallout') {
          let targetSharedFlow = xpath.select("/FlowCallout/SharedFlowBundle/text()",
                                              doc[0].documentElement);
          return isMatch(targetSharedFlow) ? item : null;
        }
        return null;
      });

    let matched = check.filter(item => !!item);
    let scanLabel = isRegex(sharedFlowName) ?
      `use of sharedflow matching pattern '${sharedFlowName}'` :
      `use of sharedflow named '${sharedFlowName}'`;

    return Promise.resolve((matched.length === 0) ? null :
                           {name, revision, policies:matched, scan:scanLabel});
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_OPTION,
  type : 'revision',
  description : 'flags each revision that has a FlowCallout to a named SharedFlow, or a SharedFlow that matches a regex',
  getScanner : getRevisionScanner
};
