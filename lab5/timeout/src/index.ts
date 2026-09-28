import { Timeouter } from "./timeouter.ts";

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

async function main(): Promise<void> {
    console.log("=== Timeouter manual tests ===\n");

    // 1. Successful operation
    console.log("1. Successful operation");

    const timeouter1 = new Timeouter({
        timeoutMs: 2000
    });

    try {
        const result = await timeouter1.withTimeout(async () => {
            console.log("Operation started");

            await sleep(500);

            console.log("Operation finished");

            return "Success";
        });

        console.log("Result:", result);
    } catch (error) {
        console.log("Error:", error);
    }


    // 2. Timeout
    console.log("\n2. Timeout");

    const timeouter2 = new Timeouter({
        timeoutMs: 1000
    });

    try {
        const result = await timeouter2.withTimeout(async () => {
            console.log("Long operation started");

            await sleep(2000);

            console.log("Long operation finished");

            return "Success";
        });

        console.log("Result:", result);
    } catch (error) {
        console.log("Error:", error);
    }


    // 3. Operation error
    console.log("\n3. Operation error");

    const timeouter3 = new Timeouter({
        timeoutMs: 2000
    });

    try {
        await timeouter3.withTimeout(async () => {
            console.log("Operation started");

            await sleep(500);

            throw new Error("Something went wrong");
        });
    } catch (error) {
        console.log("Error:", error);
    }


    // 4. Different timeout values
    console.log("\n4. Short timeout");

    const timeouter4 = new Timeouter({
        timeoutMs: 500
    });

    try {
        await timeouter4.withTimeout(async () => {
            console.log("Operation started");

            await sleep(1000);

            console.log("Operation finished");

            return "Success";
        });
    } catch (error) {
        console.log("Error:", error);
    }


    console.log("\n=== Tests finished ===");
}

main();