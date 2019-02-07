/* jshint esversion: 6, node: true */

'use strict';

const lib = require('../index.js'),
      SCAN_NAME = 'proxyname';

/*
* Accepts org, regex, and a verboseOut function. Returns a
* function that accepts (proxyDefn) and matches the name against
* the regex.
**/
function getProxyScanner(org, regex, verboseOut) {
  let re1 = new RegExp(regex);
  function scanProxyName(proxyDefn) {
    //console.log('** scanProxyName() examining: %s', proxyDefn.name);
    // This use of promise is not really needed; it's a synchronous check.
    // But in general the model allows async scans, so each
    // scanner must return a Promise.
    return new Promise( (resolve, reject) => {
      let match = re1.exec(proxyDefn.name);
      let result = (match) ? { name: proxyDefn.name, scan: "proxyname match '" + regex + "'"} : null;
      //console.log('** scanProxyName() return ' + JSON.stringify(result));
      return resolve(result);
    });
  }
  return scanProxyName;
}

module.exports = {
  option : SCAN_NAME,
  type : 'proxy',
  description : 'proxy name matching a regex',
  getScanner : getProxyScanner
};
