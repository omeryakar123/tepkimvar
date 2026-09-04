#!/usr/bin/env bun
/** Senaryo testleri — bun scripts/test-complaint-intake.mjs */
import {
  EMPTY_COMPLAINT_STATE,
  buildIntakeReply,
  getNextQuestion,
  hasMinimumComplaintInfo,
  isFrustratedRepeatMessage,
  processIntakeMessage,
  rebuildStateFromMessages,
  replyAsksKnownField,
} from "../src/lib/complaint-intake-state.ts";

const brands = [
  { id: "1", name: "FixBet" },
  { id: "2", name: "Bovbet" },
  { id: "3", name: "Kazansana" },
];

function turn(message, state = EMPTY_COMPLAINT_STATE) {
  const next = processIntakeMessage({ message, complaintState: state, brands });
  const reply = buildIntakeReply(next, message, { isFrustrated: isFrustratedRepeatMessage(message) });
  const question = getNextQuestion(next);
  return { state: next, reply, question };
}

function fromHistory(userMessages) {
  const messages = userMessages.map((content) => ({ role: "user", content }));
  const state = rebuildStateFromMessages(messages, brands);
  return state;
}

console.log("TEST 1 — fixbet full message");
{
  const state = fromHistory([
    "fixbet yatırım yaptım hesaba geçmedi canlı yardım cevap vermiyor 5000 tl",
  ]);
  console.assert(state.brandName === "FixBet", `brand=${state.brandName}`);
  console.assert(state.transactionType === "yatırım", `tx=${state.transactionType}`);
  console.assert(state.amount === 5000, `amount=${state.amount}`);
  console.assert(state.problem?.includes("yansımadı") || state.problem?.includes("geçmedi"), `problem=${state.problem}`);
  const q = getNextQuestion(state);
  console.assert(q === null, `should not ask: ${q}`);
  const reply = buildIntakeReply(state, "fixbet yatırım yaptım hesaba geçmedi 5000 tl");
  console.assert(!replyAsksKnownField(reply, state), reply);
}

console.log("TEST 2 — soyledim ya");
{
  const history = [
    { role: "user", content: "fixbet yatırım yaptım hesaba geçmedi 5000 tl" },
    { role: "assistant", content: "Tam olarak ne sorun yaşadınız?" },
    { role: "user", content: "soyledim ya" },
  ];
  const state = rebuildStateFromMessages(history, brands);
  const reply = buildIntakeReply(state, "soyledim ya", { isFrustrated: true });
  console.assert(hasMinimumComplaintInfo(state), "min info");
  console.assert(!replyAsksKnownField(reply, state), reply);
  console.assert(!/ne sorun/i.test(reply), reply);
}

console.log("TEST 3 — fixbet without amount required");
{
  const state = fromHistory(["fixbet yatırım yaptım hesaba geçmedi"]);
  console.assert(state.brandName === "FixBet");
  console.assert(state.problem);
  console.assert(getNextQuestion(state) === null, "no forced amount question");
}

console.log("TEST 4 — fixbet only");
{
  const r = turn("fixbet");
  console.assert(r.state.brandName === "FixBet");
  console.assert(r.question?.includes("ne sorun"), r.question);
}

console.log("TEST 5 — amount without brand");
{
  const r = turn("5000 TL yatırım yaptım");
  console.assert(!r.state.brandName);
  console.assert(/site|marka/i.test(r.question ?? ""), r.question);
}

console.log("TEST 6 — brand correction");
{
  let state = EMPTY_COMPLAINT_STATE;
  state = processIntakeMessage({ message: "Bovbet'te yatırım yaptım", complaintState: state, brands });
  state = processIntakeMessage({ message: "Yok Kazansana'daydı", complaintState: state, brands });
  console.assert(state.brandName === "Kazansana", state.brandName);
}

console.log("TEST 7 — amount correction");
{
  let state = EMPTY_COMPLAINT_STATE;
  state = processIntakeMessage({ message: "5000 TL yatırdım", complaintState: state, brands });
  state = processIntakeMessage({ message: "Hayır 8000 TL", complaintState: state, brands });
  console.assert(state.amount === 8000, `amount=${state.amount}`);
}

console.log("TEST 8 — ready without extra questions");
{
  const state = fromHistory(["FixBet'te dün 5000 TL yatırım yaptım ama hesabıma geçmedi"]);
  console.assert(hasMinimumComplaintInfo(state));
  console.assert(getNextQuestion(state) === null, getNextQuestion(state));
}

console.log("TEST 9 — fixbette parama coktuler (screenshot)");
{
  const state = fromHistory(["fixbette sorun yasıyorum parama coktuler"]);
  console.assert(state.brandName === "FixBet" || state.brandName === "Fixbet", `brand=${state.brandName}`);
  console.assert(state.problem, `problem=${state.problem}`);
  console.assert(getNextQuestion(state) === null, `should not ask brand: ${getNextQuestion(state)}`);
  const reply = buildIntakeReply(state, "fixbette sorun yasıyorum parama coktuler");
  console.assert(!/hangi site|hangi marka|ne sorun/i.test(reply), reply);
}

console.log("ALL TESTS PASSED");
