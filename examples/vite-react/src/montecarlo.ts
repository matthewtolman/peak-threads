import {Random} from "best-random";

const n = 60_000
const threshold = 520
const numDice = 200
const diceSides = 6

export default function() {
    let s = 0
    for (let i = 0; i < n; i++) {
        s += simul()
    }
    return s / n
}

function throwDie(rnd: Random) {
    return rnd.uint32() % diceSides
}

function simul() {
    const rnd = new Random((Math.random() * 500000000) ^ Date.now())
    let throws = 1

    while(true) {
        let sum = 0
        for (let i = 0; i < numDice; i++) {
            sum += throwDie(rnd)
        }
        if (sum >= threshold) {
            return throws
        }
        ++throws
    }
}
