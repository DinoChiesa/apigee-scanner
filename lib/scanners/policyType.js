/* jshint esversion: 6, node: true */

'use strict';

const fs = require('fs'),
      path = require('path'),
      Dom = require("@xmldom/xmldom").DOMParser,
      xpath = require("xpath"),
      SCAN_OPTION = 'policytype';

/*
* Accepts org, and a policyType name (Eg, RaiseFault, GenerateJWT,
* etc). Returns a function that accepts {(name,revision,bundleDir)} and scans
* the exploded bundle for the proxy revision for a policy of the given type.
**/
function getRevisionScanner(org, policyType, verboseOut) {
  //console.log(`policyType.revisionScanner(): ${policyType}`);

  let isMatch = (t) => (t == policyType);

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
  description : 'flags each revision with a policy of a particular type (RaiseFault, GenerateJWT, etc)',
  getScanner : getRevisionScanner
};
