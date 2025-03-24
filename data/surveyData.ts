export interface SurveySection {
  title: string;
  description?: string;
  questions: SurveyQuestion[];
}

export interface SurveyQuestion {
  question: string;
  narrative?: string;
  editableId?: string;
  data: {
    categories: string[];
    frequencies: number[];
    percentages: number[];
  };
}

export const surveyData: SurveySection[] = [
  {
    title: "SECTION A: Demographics",
    description: "This section details the demographic characteristics of the survey participants.",
    questions: [
      {
        question: "Age",
        data: {
          categories: ["18-25 years", "26-34 years", "36-45 years"],
          frequencies: [19, 22, 9],
          percentages: [38.00, 44.00, 18.00]
        }
      },
      {
        question: "Occupation",
        data: {
          categories: ["Primary level", "Secondary level", "University"],
          frequencies: [4, 29, 17],
          percentages: [8.00, 58.00, 34.00]
        }
      },
      {
        question: "Marital Status",
        data: {
          categories: ["Married", "Single"],
          frequencies: [47, 3],
          percentages: [94.00, 6.00]
        }
      },
      {
        question: "Religion",
        data: {
          categories: ["Christian", "Muslim", "Other"],
          frequencies: [47, 3, 0],
          percentages: [94.00, 6.00, 0.00]
        }
      }
    ]
  },
  {
    title: "SECTION B: Knowledge on Nutrition",
    description: "This section examines the participants' knowledge of nutrition, particularly in the context of pregnancy.",
    questions: [
      {
        question: "Have you ever heard of nutrition in pregnancy?",
        narrative: "The majority of participants, 96%, indicated that they have heard of nutrition in pregnancy, while 4% have not.",
        editableId: "heard_of_nutrition_narrative",
        data: {
          categories: ["Yes", "No"],
          frequencies: [48, 2],
          percentages: [96.00, 4.00]
        }
      },
      {
        question: "If Yes, what do you think is nutrition",
        data: {
          categories: [
            "Nutrition is the biochemical and physiological process by which organisms use food to support life", 
            "It is the act of eating spicy food", 
            "It is the act of eating 3 Square Meals"
          ],
          frequencies: [37, 0, 11],
          percentages: [77.00, 0.00, 23.00]
        }
      },
      {
        question: "Below are the signs and symptom of poor nutrition except?",
        data: {
          categories: ["Dry skin", "Hair Loss", "Crack on the corner of your mouth", "Fever"],
          frequencies: [38, 1, 9, 2],
          percentages: [76.00, 2.00, 18.00, 4.00]
        }
      },
      {
        question: "Do you know any importance of nutrition during pregnancy?",
        narrative: "A significant proportion, 74%, indicated that they know the importance of nutrition during pregnancy, while 26% do not.",
        editableId: "know_importance_narrative",
        data: {
          categories: ["Yes", "No"],
          frequencies: [37, 13],
          percentages: [74.00, 26.00]
        }
      },
      {
        question: "If yes, which of the following from below might be an importance of nutrition during pregnancy",
        data: {
          categories: ["Fetal development", "Reduces pregnancy complication", "Breast feeding Preparation", "Anemia"],
          frequencies: [21, 10, 19, 0],
          percentages: [42.00, 20.00, 38.00, 0.00]
        }
      }
    ]
  },
  {
    title: "SECTION C: Practice of Nutrition",
    description: "This section explores the participants' nutritional practices.",
    questions: [
      {
        question: "Have you eaten today",
        data: {
          categories: ["Yes", "No"],
          frequencies: [41, 9],
          percentages: [82.00, 18.00]
        }
      },
      {
        question: "If Yes what have you eaten",
        data: {
          categories: ["Rice and Source", "Bread and egg", "Fufu and eru", "Fufu and vegetable", "Yam and Vegetable"],
          frequencies: [9, 21, 17, 1, 2],
          percentages: [18.00, 42.00, 34.00, 2.00, 4.00]
        }
      },
      {
        question: "Do you take you take your vitamins medication?",
        data: {
          categories: ["Yes", "No", "I take at times"],
          frequencies: [31, 5, 14],
          percentages: [62.00, 10.00, 28.00]
        }
      },
      {
        question: "Do you take any nutritional suplements?",
        data: {
          categories: ["Yes", "No"],
          frequencies: [11, 39],
          percentages: [22.00, 78.00]
        }
      },
      {
        question: "If yes, What may be your reason?",
        data: {
          categories: [
            "Was prescribed by a doctor", 
            "I just love taking it", 
            "I take because I see other pregnant women taking it"
          ],
          frequencies: [10, 1, 0],
          percentages: [91.00, 9.00, 0.00]
        }
      }
    ]
  },
  {
    title: "SECTION D: Challenges Faced in Nutrition",
    description: "This section highlights the nutritional challenges faced by the participants.",
    questions: [
      {
        question: "Do you have any Nutritional challenge?",
        data: {
          categories: ["Yes", "No"],
          frequencies: [48, 2],
          percentages: [96.00, 4.00]
        }
      },
      {
        question: "If Yes!! Name any challenge you are having from below",
        data: {
          categories: ["Work", "Medical condition", "Loss of Appetite", "Lack of food", "Financial Issue"],
          frequencies: [2, 1, 32, 6, 7],
          percentages: [4.00, 2.00, 66.00, 12.00, 14.00]
        }
      }
    ]
  }
];
