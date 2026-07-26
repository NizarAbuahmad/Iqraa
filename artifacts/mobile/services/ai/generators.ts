import { AIRequest, AIService, LessonPlanOutput, QuizOutput, QuizQuestion, WorksheetOutput } from './AIService';

/**
 * MockAIService – returns realistic sample data.
 * Replace with OpenAI / Gemini / Azure implementations without touching calling code.
 */
export class MockAIService extends AIService {
  private async delay() {
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
  }

  async generateLessonPlan(req: AIRequest): Promise<LessonPlanOutput> {
    await this.delay();
    return {
      title: `${req.topic} – Lesson Plan`,
      grade: req.grade,
      subject: req.subject,
      duration: req.duration ?? 45,
      objectives: [
        `Students will be able to define key concepts related to ${req.topic}`,
        `Students will demonstrate understanding through practical application`,
        `Students will analyze and evaluate real-world connections to ${req.topic}`,
      ],
      materials: [
        'Textbook',
        'Whiteboard and markers',
        'Printed worksheets',
        'Calculator (if applicable)',
        'Online resources / projector',
      ],
      introduction: `Begin by activating prior knowledge with a 5-minute warm-up question related to ${req.topic}. Ask students to share what they already know. Use a brief visual or video clip to spark curiosity and set context for the lesson.`,
      mainActivity: `(25 minutes)\n\n1. Direct Instruction (10 min): Present key concepts of ${req.topic} using clear examples and visual aids. Use the I-Do model.\n\n2. Guided Practice (8 min): Work through 2–3 examples together as a class. Encourage student participation.\n\n3. Independent Practice (7 min): Students work individually or in pairs on assigned exercises. Circulate and provide targeted support.`,
      closure: `(5 minutes) Use an exit ticket: ask each student to write one thing they learned and one question they still have. Review answers briefly and preview the next lesson.`,
      assessment: `Formative: Observation during guided practice, exit tickets.\nSummative: End-of-unit quiz covering all outcomes.\nAlternative: Project-based assessment for advanced learners.`,
      differentiation: `Support: Provide graphic organizers and sentence starters for struggling learners.\nExtension: Challenge advanced students with open-ended problem-solving tasks and peer tutoring roles.`,
      homework: `Complete exercises 1–10 from the textbook on ${req.topic}. Students should show all working and circle their final answers. Due next class.`,
    };
  }

  async generateWorksheet(req: AIRequest): Promise<WorksheetOutput> {
    await this.delay();
    return {
      title: `${req.subject} – ${req.topic} Worksheet`,
      instructions: `Name: ________________  Grade: ${req.grade}  Date: ________________\n\nRead each question carefully. Show all work where applicable. Each section has a point value shown in brackets.`,
      sections: [
        {
          type: 'multiple_choice',
          title: 'Section A – Multiple Choice [20 points]',
          questions: [
            {
              text: `Which of the following best describes the main concept of ${req.topic}?`,
              options: ['Option A: A basic definition', 'Option B: An advanced property', 'Option C: An unrelated concept', 'Option D: All of the above'],
              answer: 'Option A',
              points: 4,
            },
            {
              text: `When applying ${req.topic} in a real-world context, which approach is most appropriate?`,
              options: ['Option A: Trial and error only', 'Option B: Systematic problem-solving steps', 'Option C: Estimation without calculation', 'Option D: Skipping the verification step'],
              answer: 'Option B',
              points: 4,
            },
            {
              text: `Which formula is associated with ${req.topic}?`,
              options: ['Option A: F = ma', 'Option B: E = mc²', 'Option C: Relevant formula here', 'Option D: None of the above'],
              answer: 'Option C',
              points: 4,
            },
            {
              text: 'What is the first step when solving a problem related to this topic?',
              options: ['Option A: Guess the answer', 'Option B: Identify what is given and what is asked', 'Option C: Write the conclusion first', 'Option D: Skip the problem'],
              answer: 'Option B',
              points: 4,
            },
            {
              text: 'Which of these is NOT a characteristic of this topic?',
              options: ['Option A: It has consistent rules', 'Option B: It applies to real-life situations', 'Option C: It requires no practice', 'Option D: It builds on prior knowledge'],
              answer: 'Option C',
              points: 4,
            },
          ],
        },
        {
          type: 'short_answer',
          title: 'Section B – Short Answer [30 points]',
          questions: [
            { text: `Explain in your own words what ${req.topic} means and give one real-life example.`, points: 10 },
            { text: `Describe the steps you would use to solve a problem involving ${req.topic}. Use a numbered list.`, points: 10 },
            { text: `How is ${req.topic} connected to what we have studied previously? Give at least two connections.`, points: 10 },
          ],
        },
        {
          type: 'fill_blank',
          title: 'Section C – Fill in the Blanks [10 points]',
          questions: [
            { text: `The main principle of ${req.topic} states that __________ must be considered before __________.`, points: 2 },
            { text: `When the value increases, the __________ changes proportionally according to __________.`, points: 2 },
            { text: `The three key steps in applying ${req.topic} are __________, __________, and __________.`, points: 3 },
            { text: `${req.topic} was first introduced in the context of __________ to solve __________.`, points: 3 },
          ],
        },
      ],
    };
  }

  async generateQuiz(req: AIRequest): Promise<QuizOutput> {
    await this.delay();
    const questions: QuizQuestion[] = [
      {
        id: 'q1',
        type: 'multiple_choice',
        text: `What is the primary purpose of studying ${req.topic}?`,
        options: [
          'To memorize formulas without understanding them',
          'To develop problem-solving skills applicable to real situations',
          'To complete homework faster',
          'To avoid studying other subjects',
        ],
        correctAnswer: 'To develop problem-solving skills applicable to real situations',
        points: 5,
        explanation: `Understanding ${req.topic} builds analytical thinking and prepares students for advanced topics and real-world applications.`,
      },
      {
        id: 'q2',
        type: 'true_false',
        text: `${req.topic} can be applied in multiple real-world contexts beyond the classroom.`,
        options: ['True', 'False'],
        correctAnswer: 'True',
        points: 3,
        explanation: `${req.topic} has broad applications in science, technology, daily life, and problem-solving contexts.`,
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        text: 'When solving a complex problem, which strategy is most effective?',
        options: [
          'Jump to the answer immediately',
          'Break the problem into smaller, manageable steps',
          'Copy a classmate\'s work',
          'Skip difficult questions entirely',
        ],
        correctAnswer: 'Break the problem into smaller, manageable steps',
        points: 5,
        explanation: 'Systematic problem-solving ensures accuracy and helps identify the source of any errors.',
      },
      {
        id: 'q4',
        type: 'true_false',
        text: 'Prior knowledge is not important when learning new concepts.',
        options: ['True', 'False'],
        correctAnswer: 'False',
        points: 3,
        explanation: 'Learning is cumulative. Prior knowledge provides the foundation for understanding new material effectively.',
      },
      {
        id: 'q5',
        type: 'multiple_choice',
        text: `Which of the following would be the best way to demonstrate mastery of ${req.topic}?`,
        options: [
          'Reciting a definition from memory',
          'Solving novel problems independently and explaining the reasoning',
          'Copying examples from the textbook',
          'Watching a video about it',
        ],
        correctAnswer: 'Solving novel problems independently and explaining the reasoning',
        points: 4,
        explanation: 'Mastery involves applying knowledge to unfamiliar situations and articulating the reasoning process.',
      },
    ];

    return {
      title: `${req.subject} Quiz – ${req.topic}`,
      duration: 20,
      totalPoints: questions.reduce((s, q) => s + q.points, 0),
      questions,
    };
  }

  async generateHomework(req: AIRequest): Promise<WorksheetOutput> {
    await this.delay();
    return {
      title: `Homework – ${req.topic}`,
      instructions: `Complete all questions independently. Show your work. Due: next class session.`,
      sections: [
        {
          type: 'short_answer',
          title: 'Practice Problems',
          questions: [
            { text: `Solve the following problem related to ${req.topic} and explain each step.`, points: 10 },
            { text: `Find a real-world example of ${req.topic} around your home or neighborhood. Describe it in 3–5 sentences.`, points: 10 },
            { text: `Create your own problem involving ${req.topic} and provide the solution.`, points: 10 },
          ],
        },
      ],
    };
  }
}

export const aiService = new MockAIService();
