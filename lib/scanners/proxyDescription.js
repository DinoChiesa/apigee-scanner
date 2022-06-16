/* jshint esversion: 9, node: true, strict:implied */

const SCAN_NAME = 'proxydesc';

/*
* Accepts org, and a regex, and a verboseOut fn.
* Returns a function that accepts (name,revision) and scans the proxy revision
* for a description that matches the regex.
**/
function getRevisionScanner(org, regex, verboseOut) {
  let re1 = new RegExp(regex);

  function scanRevision({name, revision}) {
    function processProxyDefn(proxyDefn) {
      let match = re1.exec(proxyDefn.description);
      let result = (match) ? {
            name: proxyDefn.name,
            revision: proxyDefn.revision,
            scan: "description match '" + regex + "'"} : null;
      return result;
    }
    // if (verboseOut) {
    //   verboseOut('looking at:' + name + ' r' + revision);
    // }
    return org.proxies.get({name,revision})
      .then(processProxyDefn);
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  description : 'proxy description matching a particular regex',
  getScanner : getRevisionScanner
};
