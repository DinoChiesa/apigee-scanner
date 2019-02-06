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
    let match = re1.exec(proxyDefn.name);
    let result = (match) ? { name: proxyDefn.name, message : "proxyname match '" + regex + "'"} : null;
    return result;
  }
  return scanProxyName;
}

module.exports = {
  option : SCAN_NAME,
  type : 'proxy',
  description : 'proxy name matching a regex',
  getScanner : getProxyScanner
};
