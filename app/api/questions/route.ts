import { NextRequest, NextResponse } from 'next/server';
import { getAnswerManager } from '@/lib/RedisUserAnswerManager';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId');
    const action = searchParams.get('action');

    if (!userId || !sessionId) {
      return NextResponse.json(
        { error: 'userId and sessionId are required' },
        { status: 400 }
      );
    }

    const answerManager = getAnswerManager();

    switch (action) {
      case 'current':
        const currentQuestion = await answerManager.getCurrentQuestion(userId, sessionId);
        return NextResponse.json({ question: currentQuestion });

      case 'progress':
        const progress = await answerManager.getUserProgress(userId, sessionId);
        return NextResponse.json({ progress });

      case 'leaderboard':
        const leaderboard = await answerManager.getLeaderboard(10);
        return NextResponse.json({ leaderboard });

      case 'all':
        const allQuestions = answerManager.getAllQuestions();
        return NextResponse.json({ questions: allQuestions });

      default:
        const userSession = await answerManager.getUserSession(userId, sessionId);
        return NextResponse.json({ session: userSession });
    }

  } catch (error) {
    console.error('Questions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, sessionId, action, answer, score, selectedOption } = await req.json();

    if (!userId || !sessionId) {
      return NextResponse.json(
        { error: 'userId and sessionId are required' },
        { status: 400 }
      );
    }

    const answerManager = getAnswerManager();

    switch (action) {
      case 'initialize':
        const userSession = await answerManager.initializeUserSession(userId, sessionId);
        return NextResponse.json({ success: true, session: userSession });

      case 'save_answer':
        if (answer === undefined || score === undefined) {
          return NextResponse.json(
            { error: 'answer and score are required' },
            { status: 400 }
          );
        }
        
        const saved = await answerManager.saveAnswer(userId, sessionId, answer, score, selectedOption);
        return NextResponse.json({ success: saved });

      case 'next_question':
        const nextQuestion = await answerManager.nextQuestion(userId, sessionId);
        return NextResponse.json({ question: nextQuestion, isCompleted: !nextQuestion });

      case 'clear_session':
        await answerManager.clearUserSession(userId, sessionId);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Questions API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
