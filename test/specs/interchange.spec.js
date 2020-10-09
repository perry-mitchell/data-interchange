const { expect } = require("chai");
const { createInterchange } = require("../../dist/interchange.js");
const { createQueue } = require("../../dist/queue.js");
const { ReadAction, WriteMode } = require("../../dist/types.js");

const slow = (value, time = 150) =>
    new Promise(resolve => {
        setTimeout(() => resolve(value), time);
    });

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
        expect(adapter)
            .to.have.property("read")
            .that.is.a("function");
        expect(adapter)
            .to.have.property("write")
            .that.is.a("function");
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

        it("updates values on sources that flagged result as 'fallback'", async function() {
            const writeSpy = sinon.stub().returnsArg(0);
            const readResultSpy = sinon.stub().returns(ReadAction.Fallback);
            const adapter = createInterchange([
                {
                    read: () => Promise.resolve({ name: "test" }),
                    readResult: readResultSpy,
                    write: writeSpy
                },
                {
                    read: () => Promise.resolve({ name: "test 2", age: 23 })
                }
            ]);
            const val = await adapter.read();
            expect(val).to.deep.equal({ name: "test 2", age: 23 });
            expect(writeSpy.callCount).to.equal(1);
            expect(writeSpy.firstCall.args[0]).to.deep.equal({ name: "test 2", age: 23 });
            expect(readResultSpy.firstCall.args[0]).to.deep.equal({ name: "test" });
        });

        it("supports conversions between sources", async function() {
            const writeSpy1 = sinon.stub().returnsArg(0);
            const writeSpy2 = sinon.stub().returnsArg(0);
            const adapter = createInterchange([
                {
                    // { n }
                    read: () => undefined,
                    write: writeSpy1
                },
                {
                    // { username }
                    read: () => undefined,
                    write: writeSpy2,
                    convert: {
                        read: val => ({ n: val.username }),
                        write: val => ({ name: val.n })
                    }
                },
                {
                    // { name }
                    read: () => Promise.resolve({ name: "test" }),
                    convert: {
                        read: val => ({ username: val.name })
                    }
                }
            ]);
            const val = await adapter.read();
            expect(val).to.deep.equal({ n: "test" });
            expect(writeSpy2.callCount).to.equal(1, "Write #2 should be called once");
            expect(writeSpy2.firstCall.args[0]).to.deep.equal({ username: "test" });
            expect(writeSpy1.callCount).to.equal(1, "Write #1 should be called once");
            expect(writeSpy1.firstCall.args[0]).to.deep.equal({ n: "test" });
        });

        it("supports queuing reads", async function() {
            const queue = createQueue();
            sinon.spy(queue, "channel");
            const adapter = createInterchange(
                [
                    {
                        read: () => undefined,
                        queueReadKey: "test"
                    },
                    {
                        read: () => slow(20),
                        queueReadKey: "test"
                    }
                ],
                { queue }
            );
            const val = await adapter.read();
            expect(val).to.equal(20);
            expect(queue.channel.calledWithExactly("test")).to.be.true;
            expect(queue.channel.callCount).to.equal(2);
        });
    });

    describe("write", function() {
        describe("in parallel", function() {
            it("writes to all sources", async function() {
                const writeSpy1 = sinon.stub().returnsArg(0);
                const writeSpy2 = sinon.stub().returnsArg(0);
                const writeSpy3 = sinon.stub().returnsArg(0);
                const adapter = createInterchange(
                    [
                        {
                            write: writeSpy1
                        },
                        {
                            write: writeSpy2
                        },
                        {
                            write: writeSpy3
                        }
                    ],
                    { writeMode: WriteMode.Parallel }
                );
                await adapter.write({ id: 1 });
                expect(writeSpy1.callCount).to.equal(1, "Write #1 should be called once");
                expect(writeSpy2.callCount).to.equal(1, "Write #1 should be called once");
                expect(writeSpy3.callCount).to.equal(1, "Write #1 should be called once");
                expect(writeSpy1.firstCall.args[0]).to.deep.equal({ id: 1 });
                expect(writeSpy2.firstCall.args[0]).to.deep.equal({ id: 1 });
                expect(writeSpy3.firstCall.args[0]).to.deep.equal({ id: 1 });
            });
        });

        describe("in series", function() {
            it("writes same data to all sources if no conversions", async function() {
                const writeSpy1 = sinon.stub().returnsArg(0);
                const writeSpy2 = sinon.stub().returnsArg(0);
                const writeSpy3 = sinon.stub().returnsArg(0);
                const adapter = createInterchange(
                    [
                        {
                            write: writeSpy1
                        },
                        {
                            write: writeSpy2
                        },
                        {
                            write: writeSpy3
                        }
                    ],
                    { writeMode: WriteMode.Series }
                );
                await adapter.write({ id: 1 });
                expect(writeSpy1.callCount).to.equal(1, "Write #1 should be called once");
                expect(writeSpy2.callCount).to.equal(1, "Write #1 should be called once");
                expect(writeSpy3.callCount).to.equal(1, "Write #1 should be called once");
                expect(writeSpy1.firstCall.args[0]).to.deep.equal({ id: 1 });
                expect(writeSpy2.firstCall.args[0]).to.deep.equal({ id: 1 });
                expect(writeSpy3.firstCall.args[0]).to.deep.equal({ id: 1 });
                expect(writeSpy3.calledBefore(writeSpy2)).to.equal(
                    true,
                    "Write #3 should occur before #2"
                );
                expect(writeSpy2.calledBefore(writeSpy1)).to.equal(
                    true,
                    "Write #2 should occur before #1"
                );
            });

            it("writes converted data from dependent sources", async function() {
                const writeSpy1 = sinon.stub().returnsArg(0);
                const writeSpy2 = sinon.stub().returnsArg(0);
                const writeSpy3 = sinon.stub().returnsArg(0);
                const adapter = createInterchange(
                    [
                        {
                            // { id }
                            write: writeSpy1
                        },
                        {
                            // { identifier }
                            write: writeSpy2,
                            convert: {
                                read: val => ({ id: val.identifier }),
                                write: val => ({ identifier: val.id })
                            }
                        },
                        {
                            // { itemID }
                            write: writeSpy3,
                            convert: {
                                read: val => ({ identifier: val.itemID }),
                                write: val => ({ itemID: val.identifier })
                            }
                        }
                    ],
                    { writeMode: WriteMode.Series }
                );
                await adapter.write({ id: 1 });
                expect(writeSpy1.firstCall.args[0]).to.deep.equal({ id: 1 });
                expect(writeSpy2.firstCall.args[0]).to.deep.equal({ identifier: 1 });
                expect(writeSpy3.firstCall.args[0]).to.deep.equal({ itemID: 1 });
            });

            it("passes written value instead of pre-calculated converted value", async function() {
                const writeSpy1 = sinon.stub().returnsArg(0);
                const writeSpy2 = sinon.stub().callsFake(() => ({ identifier: 2 }));
                const adapter = createInterchange(
                    [
                        {
                            // { id }
                            write: writeSpy1
                        },
                        {
                            // { identifier }
                            write: writeSpy2,
                            convert: {
                                read: val => ({ id: val.identifier }),
                                write: val => ({ identifier: val.id })
                            }
                        }
                    ],
                    { writeMode: WriteMode.Series }
                );
                const result = await adapter.write({ id: 1 });
                expect(writeSpy1.firstCall.args[0]).to.deep.equal({ id: 2 });
                expect(writeSpy2.firstCall.args[0]).to.deep.equal({ identifier: 1 });
                expect(writeSpy2.firstCall.returnValue).to.deep.equal({ identifier: 2 });
                expect(result).to.deep.equal({ id: 2 });
            });

            it("can skip waiting for source writes using 'writeWait'", async function() {
                const writeSpy1 = sinon.stub().returnsArg(0);
                const writeSpy2 = sinon.stub().callsFake(() => ({ identifier: 2 }));
                const adapter = createInterchange(
                    [
                        {
                            // { id }
                            write: writeSpy1
                        },
                        {
                            // { identifier }
                            write: writeSpy2,
                            convert: {
                                read: val => ({ id: val.identifier }),
                                write: val => ({ identifier: val.id })
                            },
                            writeWait: false
                        }
                    ],
                    { writeMode: WriteMode.Series }
                );
                const result = await adapter.write({ id: 1 });
                expect(writeSpy1.firstCall.args[0]).to.deep.equal({ id: 1 });
                expect(writeSpy2.firstCall.args[0]).to.deep.equal({ identifier: 1 });
                expect(result).to.deep.equal({ id: 1 });
            });

            describe("using delayed writes", function() {
                beforeEach(function() {
                    this.storage = {
                        one: undefined,
                        two: 3
                    };
                    this.source1 = {
                        read: () =>
                            new Promise(resolve => {
                                setTimeout(() => {
                                    resolve(this.storage.one);
                                }, 150);
                            }),
                        write: val =>
                            new Promise(resolve => {
                                setTimeout(() => {
                                    this.storage.one = val;
                                    resolve(this.storage.one);
                                }, 150);
                            })
                    };
                    this.source2 = {
                        read: () =>
                            new Promise(resolve => {
                                setTimeout(() => {
                                    resolve(this.storage.two);
                                }, 50);
                            }),
                        write: val =>
                            new Promise(resolve => {
                                setTimeout(() => {
                                    this.storage.two = val;
                                    resolve(this.storage.two);
                                }, 500);
                            }),
                        writeWait: false
                    };
                    this.adapter = createInterchange([this.source1, this.source2], {
                        writeMode: WriteMode.Series
                    });
                });

                it("can return before delayed writes are performed", async function() {
                    await this.adapter.write(5);
                    expect(this.storage.one).to.equal(
                        5,
                        "Non-wait storage should write immediately"
                    );
                    expect(this.storage.two).to.equal(
                        3,
                        "Non-wait storage should not write immediately"
                    );
                });

                it("can queue reads after writes", async function() {
                    this.adapter = createInterchange(
                        [
                            {
                                ...this.source2,
                                queueReadKey: () => "test",
                                queueWriteKey: () => "test"
                            }
                        ],
                        { writeMode: WriteMode.Series }
                    );
                    expect(await this.adapter.read()).to.equal(3);
                    await this.adapter.write(5);
                    expect(this.storage.two).to.equal(
                        3,
                        "Non-wait storage should not write immediately"
                    );
                    expect(await this.adapter.read()).to.equal(5);
                });
            });
        });
    });
});
