/* jslint esversion: 9, node: true */

'use strict';

const fs = require('fs'),
      path = require('path'),
      Dom = require("@xmldom/xmldom").DOMParser,
      xpath = require("xpath"),
      SCAN_OPTION = 'policytype';

/*
* Accepts org, and a policyType, which can be a name (Eg, RaiseFault,
* GenerateJWT, etc), or a regex, denoted by leading and trailing /. Returns a
* function that accepts {(name,revision,bundleDir)} and scans the exploded
* bundle for the proxy revision for a policy type that matches: if name, exact
* match; if regex, regex match.
**/
function getRevisionScanner(org, policyType, verboseOut) {
  //console.log(`policyType.revisionScanner(): ${policyType}`);

  let isMatch = (function (){
        if (policyType && policyType.startsWith('/') && policyType.endsWith('/')) {
          let regex = new RegExp(policyType.slice(1, -1));
          return (t) => t.match(regex);
        }
        // just a string match
        return (t) => (t == policyType);
      }());

  function scanRevision({name, revision, bundleDir}) {
    //console.log('bundleDir: ' + bundleDir);
    let policiesDir = path.join(bundleDir, 'apiproxy', 'policies');
    let dirExists = fs.existsSync(policiesDir);
    let policies = dirExists ? fs.readdirSync(policiesDir) : [];
    if ((policyType == 'none') && ( ! policies || policies.length == 0)) {
      return Promise.resolve({name, revision, policies:[], scan:'no policies'});
    }

    let check = policies
      .map(item => {
        let policyFilePath = path.join(policiesDir, item);
        let element = new Dom().parseFromString(
              fs.readFileSync(policyFilePath).toString()
            );
        let doc = xpath.select("/", element);
        let type =
          (doc &&
           doc[0] &&
           doc[0].documentElement &&
           doc[0].documentElement.tagName) ||
          "";
        //console.log(`policy ${item} type ${type}`);
        return isMatch(type) ? item : null;
      });

    let matched = check.filter(item => !!item);
    return Promise.resolve((matched.length === 0) ? null :
                           {name, revision, policies:matched, scan:'policy type name \'' + policyType + '\''});
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_OPTION,
  type : 'revision',
  description : 'flags each revision with a policy of a particular type (RaiseFault, GenerateJWT, etc), or a type that matches a regex',
  getScanner : getRevisionScanner
};
