// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

var db, Foo, Bar, NotExist, isActualTestFoo, isActualTestBar;
var util = require('util');

if (!process.env.COUCHDB2_TEST_SKIP_INIT) {
  require('./init.js');
}

describe('CouchDB automigrate', function() {
  it('automigrates models attached to db', function(done) {
    db = global.getSchema();

    // Make sure automigrate doesn't destroy model doesn't exist
    NotExist = db.define('NotExist', {
      id: {type: Number, index: true},
    });
    Foo = db.define('Foo', {
      name: {type: String},
    });
    Bar = db.define('Bar', {
      name: {type: String},
    });
    db.automigrate(function verifyMigratedModel(err) {
      if (err) return done(err);
      Foo.create({name: 'foo'}, function(err, r) {
        if (err) return done(err);
        r.should.not.be.empty();
        r.name.should.equal('foo');
        done();
      });
    });
  });

  it('autoupdates models attached to db', function(done) {
    db = global.getSchema();

    // each test case gets a new db since it should not contain models attached
    // to old db
    Foo = db.define('Foo', {
      updatedName: {type: String},
    });

    db.autoupdate(function(err) {
      if (err) return done(err);
      Foo.find(function(err, results) {
        if (err) return done(err);
        // Verify autoupdate doesn't destroy existing data
        results.length.should.equal(1);
        results[0].name.should.equal('foo');
        done();
      });
    });
  });

  it('destroy existing model when automigrates', function(done) {
    db = global.getSchema();

    Foo = db.define('Foo', {
      updatedName: {type: String},
    });
    db.automigrate(function(err) {
      if (err) return done(err);
      Foo.find(function(err, result) {
        if (err) return done(err);
        result.length.should.equal(0);
        done();
      });
    });
  });

  it('create index for property with `index: true`', function(done) {
    db = global.getSchema();

    Foo = db.define('Foo', {
      age: {type: Number, index: true},
      name: {type: String},
    });
    db.automigrate(function(err) {
      if (err) return done(err);
      Foo.create([
        {name: 'John', age: 20},
        {name: 'Lucy', age: 10},
        {name: 'Zoe', age: 25}], function(err, r) {
        if (err) return done(err);
        Foo.find({
          where: {age: {gt: null}},
          order: 'age',
        }, function(err, result) {
          if (err) return done(err);
          result.length.should.equal(3);
          result[0].age.should.equal(10);
          result[1].age.should.equal(20);
          result[2].age.should.equal(25);
          done();
        });
      });
    });
  });

  describe('isActual', function() {
    db = global.getSchema();

    it('returns true only when all models exist', function(done) {
      // `isActual` requires the model be attached to a db,
      // therefore use db.define here
      Foo = db.define('Foo', {
        name: {type: String},
      });
      Bar = db.define('Bar', {
        name: {type: String},
      });
      db.isActual(['Foo', 'Bar'], function(err, ok) {
        if (err) return done(err);
        ok.should.equal(true);
        done();
      });
    });

    it('returns false when one or more models not exist', function(done) {
      // model isActualTestFoo and isActualTestBar are not
      // defined/used elsewhere, so they don't exist in database
      isActualTestFoo = db.define('isActualTestFoo', {
        name: {type: String},
      });
      isActualTestBar = db.define('isActualTestBar', {
        name: {type: String},
      });
      db.isActual(['Foo', 'isActualTestFoo', 'isActualTestBar'],
        function(err, ok) {
          if (err) return done(err);
          ok.should.equal(false);
          done();
        });
    });

    it('accepts string type single model as param', function(done) {
      db.isActual('Foo', function(err, ok) {
        if (err) return done(err);
        ok.should.equal(true);
        done();
      });
    });
  });
});
