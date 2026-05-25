const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { tournamentCountsInRating, parseExtra } = require('../../src/shared/tournamentRatingPolicy');

describe('tournamentRatingPolicy', () => {
  it('defaults to counting in rating', () => {
    assert.equal(tournamentCountsInRating({}), true);
    assert.equal(tournamentCountsInRating({ extra: {} }), true);
    assert.equal(tournamentCountsInRating(null), true);
  });

  it('skips when countInRating is false', () => {
    assert.equal(tournamentCountsInRating({ extra: { countInRating: false } }), false);
    assert.equal(
      tournamentCountsInRating({ extra: JSON.stringify({ countInRating: false }) }),
      false
    );
  });

  it('parseExtra handles string JSON', () => {
    assert.deepEqual(parseExtra({ extra: '{"countInRating":false}' }), { countInRating: false });
  });
});
