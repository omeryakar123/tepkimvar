#!/usr/bin/env bun
/** Senaryo testleri — bun scripts/test-complaint-intake.mjs */
import {
  EMPTY_COMPLAINT_STATE,
  buildBodyFromState,
  buildIntakeReply,
  getNextQuestion,
  processIntakeMessage,
  replyAsksKnownField,
} from "../src/lib/complaint-intake-state.ts";

const brands = [
  { id: "1", name: "Bovbet" },
  { id: "2", name: "Kazansana" },
];

function turn(message, state = EMPTY_COMPLAINT_STATE) {
  const next = processIntakeMessage({ message, complaintState: state, brands });
  const body = buildBodyFromState(next);
  const reply = buildIntakeReply(next, body, message);
  const question = getNextQuestion(next, body);
  return { state: next, body, reply, question };
}

let state = EMPTY_COMPLAINT_STATE;
let r;

console.log("TEST 1");
r = turn("Bovbet'te sorun yaşadım.", state);
console.assert(r.state.brandName === "Bovbet", "brand");
console.assert(!r.state.problem, "problem empty");
console.assert(r.question?.includes("ne sorun"), r.question);
state = r.state;

console.log("TEST 2");
r = turn("Bovbet'te 5000 TL yatırım yaptım ama hesabıma geçmedi.", state);
console.assert(r.state.brandName === "Bovbet");
console.assert(r.state.amount === 5000);
console.assert(r.state.transactionType === "yatırım");
console.assert(r.state.problem?.includes("yansımadı"));
console.assert(!replyAsksKnownField(r.reply, r.state), r.reply);
state = r.state;

console.log("TEST 3");
r = turn("Dün yaptım.", state);
console.assert(r.state.date === "dün" || r.state.date === "Dün");
state = r.state;

console.log("TEST 4");
r = turn("5000 değil 8000 TL.", state);
console.assert(r.state.amount === 8000, `amount=${r.state.amount}`);

console.log("TEST 5");
r = turn("Yanlış söyledim, Kazansana'daydı.", state);
console.assert(r.state.brandName === "Kazansana");

console.log("TEST 6");
state = EMPTY_COMPLAINT_STATE;
r = turn("Bovbet'te dün 10.000 TL yatırım yaptım ama hesabıma geçmedi.", state);
console.assert(r.state.brandName === "Bovbet");
console.assert(!r.question || r.body.length >= 80, `should draft: q=${r.question} body=${r.body.length}`);
console.assert(r.body.length >= 80);

console.log("TEST 7");
state = EMPTY_COMPLAINT_STATE;
r = turn("Paramı vermediler.", state);
console.assert(!r.state.brandName);
console.assert(r.question?.includes("site") || r.question?.includes("marka"), r.question);

console.log("ALL TESTS PASSED");
