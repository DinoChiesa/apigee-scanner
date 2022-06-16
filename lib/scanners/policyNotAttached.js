/* jshint esversion: 9, node: true, strict: implied */

const fs = require('fs'),
      path = require('path'),
      Dom = require("@xmldom/xmldom").DOMParser,
      xpath = require("xpath"),
      SCAN_OPTION = 'policyunattached';

const getDomElement = filePath => new Dom().parseFromString(fs.readFileSync(filePath).toString() );

const xpathFind = (lookingFor) =>
(elt, subpath) => xpath.select(subpath, elt) .map(x => x.data) .indexOf(lookingFor) >=0 ;

const endpointChecker = (bundleDir, subdir, endpointType) => {
        let endpointsDir = path.join(bundleDir, 'apiproxy', subdir);
        let dirExists = fs.existsSync(endpointsDir);
        let endpointFiles = dirExists ? fs.readdirSync(endpointsDir) : [];
        endpointFiles = endpointFiles.filter( name => name && name.endsWith('.xml'));

        // optimize when there are no endpoints
        if (endpointFiles.length == 0) {
          return (lookingFor) => false;
        }

        function isAttached(lookingFor) {
          return endpointFiles
            .map(item => {
              let domElement = getDomElement(path.join(endpointsDir, item));
              let p = ["/Flows/Flow", "/PreFlow", "/PostFlow", "/PostClientFlow" ]
                .map(x => `/${endpointType}${x}`).join('|');
              let finder = xpathFind(lookingFor);
              let attached = xpath.select(p, domElement)
                .find(elt => finder(elt, "(Request|Response)/Step/Name/text()"))

              if ( !attached ) {
                let p = ["/DefaultFaultRule", "/FaultRules/FaultRule" ]
                  .map(x => `/${endpointType}${x}`).join('|');
                attached = xpath.select(p, domElement).find(elt => finder(elt, "Step/Name/text()"));
              }

              return attached;
            })
            .reduce( (a,item) => a || item, false);
        };
        return isAttached;
      };

/*
* Accepts two ignored params and a verboseOut function. Returns a function that accepts
* {(name,revision,bundleDir)} and scans the exploded bundle for any policies
* that are not attached to any flow in the bundle.
**/
function getRevisionScanner(IGNORED1, IGNORED2, verboseOut) {

  function scanRevision({name, revision, bundleDir}) {
    let policiesDir = path.join(bundleDir, 'apiproxy', 'policies');
    let dirExists = fs.existsSync(policiesDir);
    let policies = dirExists ? fs.readdirSync(policiesDir) : [];
    let policyNames = policies
      .map(item => {
        let element = getDomElement(path.join(policiesDir, item));
        let nameAttr = xpath.select("/*/@name", element);
        return (nameAttr && nameAttr[0] && nameAttr[0].value);
      })
      .filter(item => !!item);

    let pChecker = endpointChecker(bundleDir, 'proxies', 'ProxyEndpoint');
    let tChecker = endpointChecker(bundleDir, 'targets', 'TargetEndpoint');
    let unattached = policyNames.filter(lookingFor =>
                                        !pChecker(lookingFor) && !tChecker(lookingFor));

    return Promise.resolve((unattached.length === 0) ? null :
                           {name, revision, policies:unattached, scan:'unattached policies'});
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_OPTION,
  noarg : true,
  type : 'revision',
  description : 'flags each revision with a policy that is unattached',
  getScanner : getRevisionScanner
};
