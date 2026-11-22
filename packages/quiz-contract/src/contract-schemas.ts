import indexSchema from "../schema/index.v1.schema.json" with { type: "json" };
import quizSchema from "../schema/quiz.v1.schema.json" with { type: "json" };

const CONTRACT_SCHEMAS = Object.freeze({
  quiz: quizSchema,
  index: indexSchema,
});

export { CONTRACT_SCHEMAS };
