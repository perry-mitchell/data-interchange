const { expect } = require("chai");
const { createInterchange } = require("../../dist/interchange.js");

describe("interchange", function() {
    it("creates an interchange adapter", function() {
        const adapter = createInterchange([
            {
                read: () => null,
                write: () => null
            },
            {
                read: () => null,
                write: () => null
            }
        ]);
        expect(adapter).to.have.property("read").that.is.a("function");
        expect(adapter).to.have.property("write").that.is.a("function");
    });

    describe("read", function() {
        it("returns the first value if available", async function() {
            const adapter = createInterchange([
                {
                    read: () => 10
                },
                {
                    read: () => 20
                }
            ]);
            const val = await adapter.read();
            expect(val).to.equal(10);
        });

        it("returns an auxiliary value when the first is not available", async function() {
            const adapter = createInterchange([
                {
                    read: () => undefined
                },
                {
                    read: () => 20
                }
            ]);
            const val = await adapter.read();
            expect(val).to.equal(20);
        });

        it("returns undefined if no sources return a value", async function() {
            const adapter = createInterchange([
                {
                    read: () => undefined
                },
                {
                    read: () => undefined
                }
            ]);
            const val = await adapter.read();
            expect(val).to.be.undefined;
        });

        it("writes values to sources that didn't return a value", async function() {
            const writeSpy = sinon.stub().returnsArg(0);
            const adapter = createInterchange([
                {
                    read: () => undefined,
                    write: writeSpy
                },
                {
                    read: () => Promise.resolve({ name: "test" })
                }
            ]);
            const val = await adapter.read();
            expect(val).to.deep.equal({ name: "test" });
            expect(writeSpy.callCount).to.equal(1);
            expect(writeSpy.firstCall.args[0]).to.deep.equal({ name: "test" });
        });

        it("supports conversions between sources", async function() {
            const writeSpy1 = sinon.stub().returnsArg(0);
            const writeSpy2 = sinon.stub().returnsArg(0);
            const adapter = createInterchange([
                { // { n }
                    read: () => undefined,
                    write: writeSpy1
                },
                { // { username }
                    read: () => undefined,
                    write: writeSpy2,
                    convert: {
                        read: val => ({ n: val.username }),
                        write: val => ({ name: val.n })
                    }
                },
                { // { name }
                    read: () => Promise.resolve({ name: "test" }),
                    convert: {
                        read: val => ({ username: val.name })
                    }
                }
            ]);
            const val = await adapter.read();
            expect(val).to.deep.equal({ n: "test" });
            expect(writeSpy2.callCount).to.equal(1, "Write #2 should only be called once");
            expect(writeSpy2.firstCall.args[0]).to.deep.equal({ username: "test" });
            expect(writeSpy1.callCount).to.equal(1, "Write #1 should only be called once");
            expect(writeSpy1.firstCall.args[0]).to.deep.equal({ n: "test" });
        });
    });
});
