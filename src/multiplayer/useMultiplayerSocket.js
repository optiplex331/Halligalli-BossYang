import { useEffect, useRef } from "react";
import { getSocket } from "./socket.js";
import { DAILY_TARGET_ROUNDS, INITIAL_BREAKDOWN } from "../game/constants.js";
import { getSeatLayouts } from "../game/rules.js";
import { appendHistoryEntry, saveDailyGoal } from "../game/persistence.js";

export function useMultiplayerSocket({ isMultiplayer, mySeatIndex, language, actions }) {
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    if (!isMultiplayer) return;

    const socket = getSocket();
    const a = () => actionsRef.current;

    function onRoomCreated({ code, playerId, room }) {
      a().setRoomCode(code);
      a().setMyPlayerId(playerId);
      a().setRoomPlayers(room.players);
      a().setLobbyError("");
      a().setScreen("lobby");
    }

    function onRoomJoined({ playerId, room }) {
      a().setRoomCode(room.code);
      a().setMyPlayerId(playerId);
      a().setRoomPlayers(room.players);
      a().setLobbyError("");
      a().setScreen("lobby");
    }

    function onPlayerUpdate({ players: updatedPlayers }) {
      a().setRoomPlayers(updatedPlayers);
    }

    function onRoomError({ message, messageZh }) {
      a().setLobbyError(language === "zh" ? messageZh : message);
    }

    function onGameStart({ playerCount, difficulty, duration, topCards, seatMap: sm }) {
      a().setSeatMap(sm);
      if (a().matchContextRef) {
        a().matchContextRef.current = { playerCount, difficulty, durationSec: duration };
      }
      const seats = getSeatLayouts(playerCount);
      const freshPlayers = Array.from({ length: playerCount }, (_, i) => ({
        id: i,
        labelZh: sm[i]?.name || seats[i].labelZh,
        labelEn: sm[i]?.name || seats[i].labelEn,
        drawPile: [{ id: "hidden", fruit: "banana", count: 0 }],
        wonPile: [],
        faceUpPile: topCards[i] ? [topCards[i]] : [],
      }));

      a().setPlayers(freshPlayers);
      a().setCurrentTurn(0);
      a().setActingPlayer(0);
      a().setSecondsLeft(duration);
      a().setScore(0);
      a().setCorrectHits(0);
      a().setWrongHits(0);
      a().setMissedHits(0);
      a().setReactionTimes([]);
      a().setStreak(0);
      a().setActiveBellFruit(null);
      a().setScoreBreakdown(INITIAL_BREAKDOWN);
      a().setPenaltyNotice("");
      a().setBossTaunt("");
      a().setBossDisrupting(false);
      a().setTauntEchoes([]);
      a().setFeedback({ type: "idle", message: a().t("startRound") });
      a().setScreen("play");
      a().gameRunningRef.current = true;
    }

    function onYourSeat({ seatIndex }) {
      a().setMySeatIndex(seatIndex);
    }

    function onGameFlip({ seatIndex, card, nextTurn, bellAvailable, bellFruitKey, topCards }) {
      a().setPlayers((prev) =>
        prev.map((p, i) => ({
          ...p,
          faceUpPile: topCards[i] ? [topCards[i]] : [],
        })),
      );
      a().setActingPlayer(seatIndex);
      a().setCurrentTurn(nextTurn);
      a().triggerFlipAnimation(seatIndex);

      if (bellAvailable) {
        a().bellStateRef.current = {
          available: true,
          fruitKey: bellFruitKey,
          startedAt: Date.now(),
          handled: false,
        };
        a().setActiveBellFruit(bellFruitKey);
      } else {
        a().bellStateRef.current = { available: false, fruitKey: null, startedAt: 0, handled: true };
        a().setActiveBellFruit(null);
      }
    }

    function onGameMissed({ fruitKey }) {
      a().setMissedHits((v) => v + 1);
      a().setScore((v) => Math.max(0, v - 30));
      a().setScoreBreakdown((v) => ({ ...v, missedPenalty: v.missedPenalty + 30 }));
      a().setStreak(0);
      a().updateFeedback("warn", a().t("missedBell", { fruit: a().fruitLabel(fruitKey, language) }));
      a().playFeedbackSound("warn");
    }

    function onBellResult(data) {
      if (data.type === "correct") {
        a().setPlayers((prev) =>
          prev.map((p, i) => ({
            ...p,
            faceUpPile: data.topCards[i] ? [data.topCards[i]] : [],
          })),
        );
        a().setCurrentTurn(data.winnerId);
        a().setActiveBellFruit(null);
        a().bellStateRef.current = { available: false, fruitKey: null, startedAt: 0, handled: true };

        if (data.winnerId === mySeatIndex) {
          const reactionMs = Date.now() - a().bellStateRef.current.startedAt;
          a().setScore((v) => v + data.earned);
          a().setCorrectHits((v) => v + 1);
          a().setReactionTimes((v) => [...v, reactionMs]);
          a().setStreak((v) => v + 1);
          a().updateFeedback("success", a().t("bellSuccess", { count: data.collectedCount }));
          a().playFeedbackSound("success");
          a().spawnBellParticles();
        } else {
          const winnerName =
            a().seatMap[data.winnerId]?.name || `Player ${data.winnerId + 1}`;
          a().updateFeedback(
            "idle",
            `${winnerName} ${language === "zh" ? "抢铃成功" : "rang the bell"}`,
          );
        }
        a().triggerBellPress();
        a().triggerCollectAnimation();
      } else if (data.type === "wrong") {
        a().setPlayers((prev) =>
          prev.map((p, i) => ({
            ...p,
            faceUpPile: data.topCards[i] ? [data.topCards[i]] : [],
          })),
        );

        if (data.bellAvailable) {
          a().bellStateRef.current = {
            available: true,
            fruitKey: data.bellFruitKey,
            startedAt: Date.now(),
            handled: false,
          };
          a().setActiveBellFruit(data.bellFruitKey);
        }

        if (data.playerId === mySeatIndex) {
          a().setWrongHits((v) => v + 1);
          a().setScore((v) => Math.max(0, v - 50 - data.penaltyCount * 4));
          a().setScoreBreakdown((v) => ({
            ...v,
            wrongPenalty: v.wrongPenalty + 50,
            cardPenalty: v.cardPenalty + data.penaltyCount * 4,
          }));
          a().setStreak(0);
          a().updateFeedback(
            "error",
            data.penaltyCount
              ? a().t("bellPenalty", { count: data.penaltyCount })
              : a().t("bellPenaltyNone"),
          );
          if (data.penaltyCount) a().showPenalty(data.penaltyCount);
          a().playFeedbackSound("penalty");
        } else {
          const penaltyName =
            a().seatMap[data.playerId]?.name || `Player ${data.playerId + 1}`;
          a().updateFeedback(
            "idle",
            `${penaltyName} ${language === "zh" ? "错拍了" : "wrong ring"}`,
          );
        }
        a().triggerBellPress();
      }
    }

    function onGameTick({ secondsLeft: s }) {
      a().setSecondsLeft(s);
    }

    function onGameEnd({ results }) {
      a().gameRunningRef.current = false;
      a().setMultiResults(results);
      a().setScreen("result");

      const mine = results && typeof results === "object" ? results[mySeatIndex] : null;
      if (mine) {
        const ctx = a().matchContextRef?.current ?? {};
        const updated = appendHistoryEntry({
          ts: Date.now(),
          mode: "multi",
          score: mine.score,
          correctHits: mine.correctHits,
          wrongHits: mine.wrongHits,
          missedHits: mine.missedHits,
          avgReactionMs: mine.avgReactionMs ?? 0,
          bestReactionMs: mine.bestReactionMs ?? 0,
          difficulty: ctx.difficulty,
          durationSec: ctx.durationSec,
          playerCount: ctx.playerCount,
        });
        a().setHistory(updated);

        const dg = a().dailyGoal;
        if (dg) {
          const nr = dg.completedRounds + 1;
          const newDg = { ...dg, completedRounds: nr, goalReached: dg.goalReached || nr >= DAILY_TARGET_ROUNDS };
          saveDailyGoal(newDg);
          a().setDailyGoal(newDg);
        }
      }
    }

    function onRoomDissolved() {
      a().setIsMultiplayer(false);
      a().setScreen("home");
      a().setRoomCode("");
      a().setRoomPlayers([]);
    }

    socket.on("room:created", onRoomCreated);
    socket.on("room:joined", onRoomJoined);
    socket.on("room:player-update", onPlayerUpdate);
    socket.on("room:error", onRoomError);
    socket.on("game:start", onGameStart);
    socket.on("game:your-seat", onYourSeat);
    socket.on("game:flip", onGameFlip);
    socket.on("game:missed", onGameMissed);
    socket.on("game:bell-result", onBellResult);
    socket.on("game:tick", onGameTick);
    socket.on("game:end", onGameEnd);
    socket.on("room:dissolved", onRoomDissolved);

    return () => {
      socket.off("room:created", onRoomCreated);
      socket.off("room:joined", onRoomJoined);
      socket.off("room:player-update", onPlayerUpdate);
      socket.off("room:error", onRoomError);
      socket.off("game:start", onGameStart);
      socket.off("game:your-seat", onYourSeat);
      socket.off("game:flip", onGameFlip);
      socket.off("game:missed", onGameMissed);
      socket.off("game:bell-result", onBellResult);
      socket.off("game:tick", onGameTick);
      socket.off("game:end", onGameEnd);
      socket.off("room:dissolved", onRoomDissolved);
    };
  }, [isMultiplayer, mySeatIndex, language]);
}
