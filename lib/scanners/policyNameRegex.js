/* jshint esversion: 9, node: true, strict: implied */

const fs = require('fs'),
      path = require('path'),
      Dom = require("@xmldom/xmldom").DOMParser,
      xpath = require("xpath"),
      SCAN_NAME = 'policyname';

/*
* Accepts org, and a regex (Eg, ^AM-.*). Returns a function that accepts
* {(name,revision,bundleDir)} and scans the exploded bundle for the proxy
* revision for a policy with a name that matches the given regex.
**/
function getRevisionScanner(org, regex, verboseOut) {
  let re1 = new RegExp(regex);
  let isMatch = (t) => (t.match(re1));

  function scanRevision({name, revision, bundleDir}) {
    let policiesDir = path.join(bundleDir, 'apiproxy', 'policies');
    let dirExists = fs.existsSync(policiesDir);
    let policies = dirExists ? fs.readdirSync(policiesDir) : [];
    let check = policies
      .map(item => {
        let policyFilePath = path.join(policiesDir, item);
        let element = new Dom().parseFromString(
              fs.readFileSync(policyFilePath).toString()
            );
        let nameAttr = xpath.select("/*/@name", element);
        let policyName =
          (nameAttr &&
           nameAttr[0] &&
           nameAttr[0].value) ||
          "";
        return isMatch(policyName) ? item : null;
      });

    let matched = check.filter(item => !!item);
    return Promise.resolve((matched.length === 0) ? null :
                           {name, revision, policies:matched, scan:'policy name regex \'' + regex + '\''});
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  description : 'flags each revision with a policy with a name that matches a pattern',
  getScanner : getRevisionScanner
};
