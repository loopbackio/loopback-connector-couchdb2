// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

/*
NOTE: This suite is also used by loopback-connector-cloudant. 
To support Optional Test Opt-In/Out, names of tests to be skipped
can be added to skips array. All tests must start with a check to 
see if the test should be skipped or not.
The following line can be used to accomplish this: 

this.test.pending ? this.skip() : null;
*/

var should = require('should');
var db, Thing, Foo;
var N = 201;

if (!process.env.COUCHDB2_TEST_SKIP_INIT) {
  require('./init.js');
}

// This test suite creates large number of data,
// require more time to complete data cleanUp
// There is no batchDestroy in CouchDB, so `automigrate`
// fetches all instances then delete them one by one
describe('CouchDB2 max rows', function() {
  this.timeout(99999);

  var skips = [
    'find all limt ten',
    'find all skip ten limit ten',
    'find all skip two hundred'
  ]

  if (process.env.COUCHDB2_TEST_MAXROWS_SKIP) {
    skips = JSON.parse(process.env.COUCHDB2_TEST_MAXROWS_SKIP).skip;
  }

  before(function(done) {
    db = getSchema();
    Foo = db.define('Foo', {
      bar: {type: Number, index: true},
    });
    Thing = db.define('Thing', {
      title: Number,
    });
    Thing.belongsTo('foo', {model: Foo});
    Foo.hasMany('things', {foreignKey: 'fooId'});
    db.automigrate(done);
  });

  beforeEach(function() {
    if (skips.indexOf(this.currentTest.title) > -1) {
      this.currentTest.pending = true;
    }
  });

  it('create two hundred and one', function(done) {
    this.test.pending ? this.skip() : null;

    var foos = Array.apply(null, {length: N}).map(function(n, i) {
      return {bar: i};
    });
    Foo.create(foos, function(err, entries) {
      should.not.exist(err);
      entries.should.have.lengthOf(N);
      done();
    });
  });

  it('find all two hundred and one', function(done) {
    this.test.pending ? this.skip() : null;

    Foo.all({limit: N}, function(err, entries) {
      if (err) return done(err);
      entries.should.have.lengthOf(N);
      var things = Array.apply(null, {length: N}).map(function(n, i) {
        return {title: i, fooId: entries[i].id};
      });
      Thing.create(things, function(err, things) {
        if (err) return done(err);
        things.should.have.lengthOf(N);
        done();
      });
    });
  });

  it('find all limt ten', function(done) {
    this.test.pending ? this.skip() : null;

    Foo.all({limit: 10, order: 'bar'}, function(err, entries) {
      if (err) return done(err);
      entries.should.have.lengthOf(10);
      entries[0].bar.should.equal(0);
      done();
    });
  });

  it('find all skip ten limit ten', function(done) {
    this.test.pending ? this.skip() : null;

    Foo.all({skip: 10, limit: 10, order: 'bar'}, function(err, entries) {
      if (err) return done(err);
      entries.should.have.lengthOf(10);
      entries[0].bar.should.equal(10);
      done();
    });
  });

  it('find all skip two hundred', function(done) {
    this.test.pending ? this.skip() : null;

    Foo.all({skip: 200, order: 'bar'}, function(err, entries) {
      if (err) return done(err);
      entries.should.have.lengthOf(1);
      entries[0].bar.should.equal(200);
      done();
    });
  });

  it('find all things include foo', function(done) {
    this.test.pending ? this.skip() : null;

    Thing.all({include: 'foo'}, function(err, entries) {
      if (err) return done(err);
      entries.forEach(function(t) {
        t.__cachedRelations.should.have.property('foo');
        var foo = t.__cachedRelations.foo;
        foo.should.have.property('id');
      });
      done();
    });
  });

  after(function(done) {
    Foo.destroyAll(function() {
      Thing.destroyAll(function() {
        done();
      });
    });
  });
});
