const { expect } = require("chai");
const { BOOMERANG_RETURN, boomerang } = require("../../dist/boomerang.js");

describe("boomerang", function() {
    it("iterates through arrays", async function() {
        const spy = sinon.spy();
        await boomerang([1, 2, 3], spy);
        expect(spy.callCount).to.equal(3);
        expect(spy.calledWithExactly(1, 0, false)).to.be.true;
        expect(spy.calledWithExactly(2, 1, false)).to.be.true;
        expect(spy.calledWithExactly(3, 2, false)).to.be.true;
    });

    it("supports returning when symbol processed", async function() {
        const stub = sinon.stub().returns(Promise.resolve());
        stub.onCall(2).returns(Promise.resolve(BOOMERANG_RETURN));
        await boomerang([1, 2, 3, 4, 5], stub);
        // Calls: 1 2 3 2 1
        expect(stub.callCount).to.equal(5);
        expect(stub.calledWithExactly(1, 0, false)).to.be.true;
        expect(stub.calledWithExactly(2, 1, false)).to.be.true;
        expect(stub.calledWithExactly(3, 2, false)).to.be.true;
        expect(stub.calledWithExactly(2, 1, true)).to.be.true;
        expect(stub.calledWithExactly(1, 0, true)).to.be.true;
    });
});
