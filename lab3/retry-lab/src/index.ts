import { Retrier } from "./retrier";

const sleep = (ms: number) =>
    new Promise(resolve => setTimeout(resolve, ms));

async function main() {

    // 1. Success on first attempt
    console.log("=== Test 1: success immediately ===");

    const retrier1 = new Retrier({
        maxAttempts: 3,
        pauseStrategy: {
            type: "constant",
            delay: 1000
        },
        retryOn: () => true
    });

    let attempts1 = 0;

    const result1 = await retrier1.execute(async () => {
        attempts1++;
        console.log(`Attempt ${attempts1}`);

        return "Success!";
    });

    console.log("Result:", result1);


    // 2. Fail twice, succeed on third attempt
    console.log("\n=== Test 2: fail twice, then succeed ===");

    const retrier2 = new Retrier({
        maxAttempts: 3,
        pauseStrategy: {
            type: "constant",
            delay: 1000
        },
        retryOn: () => true
    });

    let attempts2 = 0;

    const result2 = await retrier2.execute(async () => {
        attempts2++;
        console.log(`Attempt ${attempts2}`);

        if (attempts2 < 3) {
            throw new Error("Temporary error");
        }

        return "Success on third attempt!";
    });

    console.log("Result:", result2);


    // 3. Max attempts reached
    console.log("\n=== Test 3: max attempts ===");

    const retrier3 = new Retrier({
        maxAttempts: 3,
        pauseStrategy: {
            type: "constant",
            delay: 1000
        },
        retryOn: () => true
    });

    let attempts3 = 0;

    try {
        await retrier3.execute(async () => {
            attempts3++;
            console.log(`Attempt ${attempts3}`);

            throw new Error("Something went wrong");
        });
    } catch (error) {
        console.log("Final error:", error);
    }


    // 4. Non-retryable error
    console.log("\n=== Test 4: non-retryable error ===");

    const retrier4 = new Retrier({
        maxAttempts: 5,
        pauseStrategy: {
            type: "constant",
            delay: 1000
        },
        retryOn: () => false
    });

    let attempts4 = 0;

    try {
        await retrier4.execute(async () => {
            attempts4++;
            console.log(`Attempt ${attempts4}`);

            throw new Error("Fatal error");
        });
    } catch (error) {
        console.log("Final error:", error);
    }


    // 5. Exponential delay
    console.log("\n=== Test 5: exponential delay ===");

    const retrier5 = new Retrier({
        maxAttempts: 4,
        pauseStrategy: {
            type: "exponential",
            delay: 1000
        },
        retryOn: () => true
    });

    let attempts5 = 0;

    try {
        await retrier5.execute(async () => {
            attempts5++;

            console.log(
                `Attempt ${attempts5} at ${new Date().toLocaleTimeString()}`
            );

            throw new Error("Temporary error");
        });
    } catch (error) {
        console.log("Finished:", error);
    }


    // 6. Exponential jitter
    console.log("\n=== Test 6: exponential jitter ===");

    const retrier6 = new Retrier({
        maxAttempts: 4,
        pauseStrategy: {
            type: "exponentialJitter",
            delay: 1000
        },
        retryOn: () => true
    });

    let attempts6 = 0;

    try {
        await retrier6.execute(async () => {
            attempts6++;

            console.log(
                `Attempt ${attempts6} at ${new Date().toLocaleTimeString()}`
            );

            throw new Error("Temporary error");
        });
    } catch (error) {
        console.log("Finished:", error);
    }
}

main();