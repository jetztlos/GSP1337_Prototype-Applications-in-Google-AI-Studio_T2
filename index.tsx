/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI} from '@google/genai';

interface Flashcard {
  term: string;
  definition: string;
}

const topicInput = document.getElementById('topicInput') as HTMLTextAreaElement;
const generateButton = document.getElementById(
  'generateButton',
) as HTMLButtonElement;
const addMoreButton = document.getElementById(
  'addMoreButton',
) as HTMLButtonElement;
const flashcardsContainer = document.getElementById(
  'flashcardsContainer',
) as HTMLDivElement;
const errorMessage = document.getElementById('errorMessage') as HTMLDivElement;

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

let currentFlashcards: Flashcard[] = [];

// Helper function to create a flashcard element
function createFlashcardElement(
  flashcard: Flashcard,
  index: number,
): HTMLDivElement {
  const cardDiv = document.createElement('div');
  cardDiv.classList.add('flashcard');
  cardDiv.dataset['index'] = index.toString();
  cardDiv.setAttribute(
    'aria-label',
    `Flashcard for ${flashcard.term}. Click to flip.`,
  );

  const cardInner = document.createElement('div');
  cardInner.classList.add('flashcard-inner');

  const cardFront = document.createElement('div');
  cardFront.classList.add('flashcard-front');

  const termDiv = document.createElement('div');
  termDiv.classList.add('term');
  termDiv.textContent = flashcard.term;

  const cardBack = document.createElement('div');
  cardBack.classList.add('flashcard-back');

  const definitionDiv = document.createElement('div');
  definitionDiv.classList.add('definition');
  definitionDiv.textContent = flashcard.definition;

  cardFront.appendChild(termDiv);
  cardBack.appendChild(definitionDiv);
  cardInner.appendChild(cardFront);
  cardInner.appendChild(cardBack);
  cardDiv.appendChild(cardInner);

  // Add click listener to flip card and unflip others
  cardDiv.addEventListener('click', () => {
    const isCurrentlyFlipped = cardDiv.classList.contains('flipped');
    flashcardsContainer.querySelectorAll('.flashcard').forEach((card) => {
      card.classList.remove('flipped');
    });
    if (!isCurrentlyFlipped) {
      cardDiv.classList.add('flipped');
    }
  });

  return cardDiv;
}

// Helper function to parse response text into Flashcard array
function parseFlashcards(responseText: string): Flashcard[] {
  return responseText
    .split('\n')
    .map((line) => {
      const parts = line.split(':');
      if (parts.length >= 2 && parts[0].trim()) {
        const term = parts[0].trim();
        const definition = parts.slice(1).join(':').trim();
        if (definition) {
          return {term, definition};
        }
      }
      return null;
    })
    .filter((card): card is Flashcard => card !== null);
}

generateButton.addEventListener('click', async () => {
  const topic = topicInput.value.trim();
  if (!topic) {
    errorMessage.textContent =
      'Please enter a topic or some terms and definitions.';
    flashcardsContainer.textContent = '';
    addMoreButton.classList.add('hidden');
    return;
  }

  errorMessage.textContent = 'Generating flashcards...';
  flashcardsContainer.textContent = '';
  currentFlashcards = [];
  generateButton.disabled = true; // Disable button during generation
  addMoreButton.classList.add('hidden');

  try {
    const prompt = `Generate a list of flashcards for the topic of "${topic}". Each flashcard should have a term and a concise definition. Format the output as a list of "Term: Definition" pairs, with each pair on a new line. Ensure terms and definitions are distinct and clearly separated by a single colon. Here's an example output:
    Hello: Hola
    Goodbye: Adiós`;
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const responseText = result?.text ?? '';

    if (responseText) {
      const flashcards = parseFlashcards(responseText);

      if (flashcards.length > 0) {
        errorMessage.textContent = '';
        currentFlashcards = flashcards;
        flashcards.forEach((flashcard, index) => {
          const cardElement = createFlashcardElement(flashcard, index);
          flashcardsContainer.appendChild(cardElement);
        });
        addMoreButton.classList.remove('hidden');
      } else {
        errorMessage.textContent =
          'No valid flashcards could be generated from the response. Please check the format.';
      }
    } else {
      errorMessage.textContent =
        'Failed to generate flashcards or received an empty response. Please try again.';
    }
  } catch (error: unknown) {
    console.error('Error generating content:', error);
    const detailedError =
      (error as Error)?.message || 'An unknown error occurred';
    errorMessage.textContent = `An error occurred: ${detailedError}`;
    flashcardsContainer.textContent = ''; // Clear cards on error
  } finally {
    generateButton.disabled = false; // Re-enable button
  }
});

addMoreButton.addEventListener('click', async () => {
  const topic = topicInput.value.trim();
  if (!topic || currentFlashcards.length === 0) {
    errorMessage.textContent =
      'Cannot add more cards without an initial topic and set of cards.';
    return;
  }

  errorMessage.textContent = 'Generating more flashcards...';
  addMoreButton.disabled = true;
  addMoreButton.textContent = 'Adding...';

  try {
    const existingTerms = currentFlashcards.map((card) => card.term).join(', ');
    const prompt = `I am studying the topic of "${topic}". I already have flashcards for the following terms: ${existingTerms}. Please generate 5 more unique flashcards related to the same topic. Do not repeat any of the terms I already have. Format the output as a list of "Term: Definition" pairs, with each pair on a new line.`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const responseText = result?.text ?? '';

    if (responseText) {
      const newFlashcards = parseFlashcards(responseText);
      const uniqueNewFlashcards = newFlashcards.filter(
        (newCard) =>
          !currentFlashcards.some(
            (existingCard) =>
              existingCard.term.toLowerCase() === newCard.term.toLowerCase(),
          ),
      );

      if (uniqueNewFlashcards.length > 0) {
        errorMessage.textContent = '';
        uniqueNewFlashcards.forEach((flashcard) => {
          const newIndex = currentFlashcards.length;
          currentFlashcards.push(flashcard);
          const cardElement = createFlashcardElement(flashcard, newIndex);
          flashcardsContainer.appendChild(cardElement);
        });
      } else {
        errorMessage.textContent =
          'Could not generate any new unique flashcards. Try a broader topic.';
      }
    } else {
      errorMessage.textContent =
        'Failed to generate more flashcards. Please try again.';
    }
  } catch (error: unknown) {
    console.error('Error generating more content:', error);
    const detailedError =
      (error as Error)?.message || 'An unknown error occurred';
    errorMessage.textContent = `An error occurred while adding more cards: ${detailedError}`;
  } finally {
    addMoreButton.disabled = false;
    addMoreButton.textContent = 'Add 5 More';
  }
});
