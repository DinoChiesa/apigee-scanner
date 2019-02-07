# Scan Apigee Edge Proxies

This tool scans proxies for various conditions, for example,
proxies that refer to a specified vhost, or proxies with a name
that matches a regex. The tool then reports out the name of the
matching proxies.

This can be helpful in enforcing compliance rules: eg, proxies
must not listen on the the 'default' (insecure) vhost , or proxies
must have a name that conforms to a specific pattern, or proxies
must not use specific policy types, etc.

The output of this tool may be used for further investigation or reports out to
team collaboration systems, like slack or Google chat.

## Pre-requisites

* Node v6.2 or above
* npm

## Don't forget to Install node modules

```
npm install
```

## Getting Help

Invoke the tool with -h to get help:
```
node ./scanProxies.js -h
Usage:
  node scanProxies.js [OPTION]

Options:
  -M, --mgmtserver=ARG the base path, including optional port, of the Edge mgmt server. Defaults to https://api.enterprise.apigee.com .
  -u, --username=ARG   org user with permissions to read Edge configuration.
  -p, --password=ARG   password for the org user.
  -n, --netrc          retrieve the username + password from the .netrc file. In lieu of -u/-p
  -o, --org=ARG        the Edge organization.
  -T, --notoken        do not try to obtain an oauth token.
  -v, --verbose
  -h, --help
  -q, --quiet          Optional. be quiet.
  -d, --deployed       Optional. restrict scan to revisions of proxies that are deployed.
  -L, --list           Optional. list the scanners available.
      --policytype=ARG flags each revision with a policy of a particular type (RaiseFault, GenerateJWT, etc)
      --proxydesc=ARG  proxy description matching a particular regex
      --proxyname=ARG  proxy name matching a regex
      --targettype=ARG proxy with a specified target type (hosted, http, local, script)
      --vhost=ARG      proxy revision with a reference to a particular vhost
      --targetssl      proxy with an http target with TLS disabled or no Truststore
```

## Example Usage

After you install the node modules you can run the tool:

```
node ./scanProxies.js -o $ORG -n -v  --policytype GenerateJWT
```

Example output:
```
[
  {
    "name": "sujnana-jwt-1",
    "revision": "11",
    "policies": [
      "GenerateJWT-1",
      "GenerateJWT-2",
      "GenerateJWT-3"
    ],
    "message": "policy type name 'GenerateJWT'"
  },
  {
    "name": "jwt-generate",
    "revision": "6",
    "policies": [
      "Generate-JWT-HS256-Basic",
      "Generate-JWT-RS256-AdditionalClaims",
      "Generate-JWT-RS256-Basic"
    ],
    "message": "policy type name 'GenerateJWT'"
  }
]
```

## Available Scanners

```
Scanners:
  --policytype ARG   flags each revision with a policy of a particular type (RaiseFault, GenerateJWT, etc)
  --proxydesc ARG    proxy description matching a particular regex
  --proxyname ARG    proxy name matching a regex
  --targettype ARG   proxy with a specified target type (hosted, http, local, script)
  --vhost ARG        proxy revision with a reference to a particular vhost
  --targetssl        proxy with an http target with TLS disabled or no Truststore
```

Find the scanners in [lib/scanners](./lib/scanners).

List them at runtime with the `--list` option:

```
node ./scanProxies.js --list
```


## Scanning only Deployed Proxies

Use the `--deployed` option to tell the tool to examine only proxy revisions that are deployed.  In a large organization with many revisions of lots of proxies, this can save lots of time.

```
node ./scanProxies.js -o $ORG -n -v --deployed  --proxydesc '^((?!@example.com).)*$'
```

## Combining Criteria

You can use more than one of the scanners in a single run, like this:

```
node ./scanProxies.js -o $ORG -n -v --deployed  --proxydesc '^((?!@example.com).)*$'  --policytype XMLToJSON
```

The result is the set of proxies which is the union of all that have matched for each option.


## Specific Usage Examples

1. Find deployed proxies with names that don't look like foo-1 or bar-2:

   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --proxyname '^(?!((foo|bar)-(/d)))'
   ```

2. Find deployed proxies that use the XMLToJSON policy:

   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --policytype XMLToJSON
   ```

3. Find deployed proxies that do not include an email address in the description.
   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --proxydesc '^((?!@example.com).)*$'
   ```

4. Find deployed proxies that listen on the insecure vhost
   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --vhost default
   ```

5. Find deployed proxies that have TLS configured incorrectly on any target
   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --targetssl
   ```

6. Find deployed proxies that use a script (trireme nodejs) target
   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --targettype script
   ```


## Adding Scanners

It's straightforward to add more scanners.
Just add a new .js file to the [scanners](./lib/scanners) directory.
Follow the example in the existing scanners.
The scan tool will invoke the scanner if the command-line option for that scanner is present.


## Future Enhancements

In the future this tool might post its results to Slack.

## Bugs

None?


