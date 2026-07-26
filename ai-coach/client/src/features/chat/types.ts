export type ChatResponse = {
  answer: string;

  usage?: {
    input_tokens: number;

    output_tokens: number;

    total_tokens: number;
  };
};
