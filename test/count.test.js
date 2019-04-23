// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-connector-couchdb2
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

'use strict';

const _ = require('lodash');
const should = require('should');
const COUNT_OF_SAMPLES = 70;
var db, TestCountUser;

if (!process.env.COUCHDB2_TEST_SKIP_INIT) {
  require('./init.js');
}

function create50Samples() {
  var r = [];
  for (var i = 0; i < COUNT_OF_SAMPLES; i++) {
    r.push({name: 'user'.concat(i)});
  }
  return r;
};

function cleanUpData(done) {
  TestCountUser.destroyAll(done);
};

describe('count', function() {
  before((done) => {
    // globalLimit is greater than COUNT_OF_SAMPLES
    const config = _.assign(global.config, {globalLimit: 100});
    const samples = create50Samples();
    db = global.getDataSource(config);

    TestCountUser = db.define('TestCountUser', {
      name: {type: String},
    }, {forceId: false});

    db.automigrate((err) => {
      if (err) return done(err);
      TestCountUser.create(samples, done);
    });
  });

  it('returns more than 25 results with global limit set', (done) => {
    TestCountUser.count((err, r)=> {
      if (err) return done(err);
      r.should.equal(COUNT_OF_SAMPLES);
      done();
    });
  });

  it('destroys more than 25 results with global limit set', (done) => {
    cleanUpData((err)=> {
      if (err) return done(err);
      TestCountUser.count((err, r) => {
        if (err) return done(err);
        r.should.equal(0);
        done();
      });
    });
  });
});
