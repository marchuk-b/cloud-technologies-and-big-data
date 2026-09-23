import { Throttler } from "./throttler";

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

async function main(): Promise<void> {
    console.log("=== Throttler manual tests ===\n");

    // 1. Leading: only N calls are executed within the interval
    console.log("1. Rate limit");

    const throttler1 = new Throttler({
        rate: {
            maxCallsNumber: 3,
            delay: 1000
        },
        leading: true,
        trailing: false
    });

    const throttled1 = throttler1.throttle((value: number) => {
        console.log(`Executed: ${value}`);
    });

    console.log("Calling 5 times:");

    for (let i = 1; i <= 5; i++) {
        throttled1(i);
    }

    console.log("Waiting for next interval...\n");

    await sleep(1100);

    throttled1(6);

    await sleep(100);


    // 2. Dropping excess calls
    console.log("\n2. Dropping excess calls");

    const throttler2 = new Throttler({
        rate: {
            maxCallsNumber: 2,
            delay: 1000
        },
        leading: true,
        trailing: false
    });

    const throttled2 = throttler2.throttle((value: string) => {
        console.log(`Executed: ${value}`);
    });

    console.log("Calling A, B, C, D:");

    throttled2("A");
    throttled2("B");
    throttled2("C");
    throttled2("D");

    await sleep(1100);


    // 3. Queue
    console.log("\n3. Queue");

    const throttler3 = new Throttler({
        rate: {
            maxCallsNumber: 2,
            delay: 1000
        },
        leading: true,
        trailing: true
    });

    const throttled3 = throttler3.throttle((value: string) => {
        console.log(`Executed: ${value}`);
    });

    console.log("Calling A, B, C, D, E:");

    throttled3("A");
    throttled3("B");
    throttled3("C");
    throttled3("D");
    throttled3("E");

    console.log("First batch executed immediately.");

    await sleep(1100);

    console.log("Second batch:");

    await sleep(1100);

    console.log("Third batch:");

    await sleep(100);


    // 4. Leading false
    console.log("\n4. Leading = false");

    const throttler4 = new Throttler({
        rate: {
            maxCallsNumber: 2,
            delay: 1000
        },
        leading: false,
        trailing: true
    });

    const throttled4 = throttler4.throttle((value: number) => {
        console.log(`Executed: ${value}`);
    });

    console.log("Calling 1, 2, 3:");

    throttled4(1);
    throttled4(2);
    throttled4(3);

    console.log("Nothing should execute immediately.");

    await sleep(1100);

    console.log("After 1 second:");

    await sleep(1100);

    console.log("After 2 seconds:");

    console.log("\n=== Tests finished ===");
}

main();