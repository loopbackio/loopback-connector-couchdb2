# loopback-connector-couchdb2

The `loopback-connector-couchdb2` module is the CouchDB 2.0 connector for the
LoopBack framework that supports the advanced functionality originally found
only in Cloudant but that is now available in CouchDB.

# Testing

### Docker
- Assuming you have [Docker](https://docs.docker.com/engine/installation/) installed, run the following script which would spawn a Couch instance on your local:
```bash
source setup.sh <HOST> <USER> <PASSWORD> <PORT> <DATABASE>
```
where `<HOST>`, `<PORT>`, `<USER>`, `<PASSWORD>` and `<DATABASE>` are optional parameters. The default values are `localhost`, `5984`, `admin`, `pass` and `testdb` respectively.
- Run the test:
```bash
npm run mocha
```
