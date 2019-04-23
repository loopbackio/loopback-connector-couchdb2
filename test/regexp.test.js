// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

// Comment test cases to get CI pass,
// will recover them when CI config done

'use strict';

var should = require('should');
var db;

if (!process.env.COUCHDB2_TEST_SKIP_INIT) {
  require('./init.js');
}

describe('CouchDB2 regexp', function() {
  this.timeout(99999);
  var Foo;
  var N = 10;

  before(function(done) {
    db = global.getSchema();
    Foo = db.define('Foo', {
      bar: {type: String, index: true},
    });
    db.automigrate(done);
  });

  it('create some foo', function(done) {
    var foos = Array.apply(null, {length: N}).map(function(n, i) {
      return {bar: String.fromCharCode(97 + i)};
    });
    Foo.create(foos, function(err, entries) {
      should.not.exist(err);
      entries.should.have.lengthOf(N);
      done();
    });
  });

  it('find all foos beginning with b', function(done) {
    Foo.find({where: {bar: {regexp: '^b'}}}, function(err, entries) {
      if (err) return done(err);
      entries.should.have.lengthOf(1);
      entries[0].bar.should.equal('b');
      done();
    });
  });

  it('find all foos that are case-insensitive B', function(done) {
    Foo.find({where: {bar: {regexp: '/B/i'}}}, function(err, entries) {
      if (err) return done(err);
      entries.should.have.lengthOf(1);
      entries[0].bar.should.equal('b');
      done();
    });
  });

  it('find all foos like b', function(done) {
    Foo.find({where: {bar: {like: 'b'}}}, function(err, entries) {
      if (err) return done(err);
      entries.should.have.lengthOf(1);
      entries[0].bar.should.equal('b');
      done();
    });
  });

  it('find all foos not like b', function(done) {
    Foo.find({where: {bar: {nlike: 'b'}}}, function(err, entries) {
      if (err) return done(err);
      entries.should.have.lengthOf(N - 1);
      done();
    });
  });

  it('find all foos like b with javascript regex', function(done) {
    Foo.find({where: {bar: {like: /B/i}}}, function(err, entries) {
      if (err) return done(err);
      entries.should.have.lengthOf(1);
      entries[0].bar.should.equal('b');
      done();
    });
  });

  it('find all foos not like b with javascript regex', function(done) {
    Foo.find({where: {bar: {nlike: /B/i}}}, function(err, entries) {
      if (err) return done(err);
      entries.should.have.lengthOf(N - 1);
      done();
    });
  });

  after(function(done) {
    Foo.destroyAll(function() {
      done();
    });
  });
});
