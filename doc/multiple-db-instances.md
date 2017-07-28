# Multiple database instance

Whenever the connector calls a driver method inside a model level function, it first detects the datasource that model attached to, then gets the driver instance in that datasource, instead of just calling `this.methodName`.

For example, in function `Couchdb.prototype.destroy`, we call driver function by [`mo.db.destroy`](https://github.com/strongloop/loopback-connector-couchdb2/blob/cbd3ecb70f9ebf0445ee8dd4caf95bfe1df6882a/lib/couchdb.js#L372), `mo` is the model.

More code example & test case to demo/verify this feature are in progress.