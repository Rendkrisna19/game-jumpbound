import { useRef, useState } from 'react';
import { input, pressJump } from '../game/input';
import { audio } from '../audio/AudioManager';

/** On-screen joystick + jump/sprint buttons for touch devices. Writes into the shared input state. */
export default function TouchControls() {
  const base = useRef(null);
  const knob = useRef(null);
  const pointer = useRef(null);
  const [jumpHeld, setJumpHeld] = useState(false);
  const [sprintHeld, setSprintHeld] = useState(false);

  const updateStick = (e) => {
    const rect = base.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    input.touch.active = true;
    input.touch.x = dx / max;
    input.touch.y = -dy / max;
  };
  const endStick = () => {
    pointer.current = null;
    input.touch.active = false;
    input.touch.x = input.touch.y = 0;
    if (knob.current) knob.current.style.transform = '';
  };

  return (
    <div className="touch">
      <div
        ref={base}
        className="joystick"
        onPointerDown={(e) => {
          audio.unlock();
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateStick(e);
        }}
        onPointerMove={(e) => e.pointerId === pointer.current && updateStick(e)}
        onPointerUp={endStick}
        onPointerCancel={endStick}
      >
        <div ref={knob} className="joystick-knob" />
      </div>
      <div
        className={`touch-btn sprint ${sprintHeld ? 'held' : ''}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          input.touchSprint = true;
          setSprintHeld(true);
        }}
        onPointerUp={() => {
          input.touchSprint = false;
          setSprintHeld(false);
        }}
        onPointerCancel={() => {
          input.touchSprint = false;
          setSprintHeld(false);
        }}
      >
        RUN
      </div>
      <div
        className={`touch-btn jump ${jumpHeld ? 'held' : ''}`}
        onPointerDown={(e) => {
          audio.unlock();
          e.currentTarget.setPointerCapture(e.pointerId);
          input.touchJump = true;
          pressJump();
          setJumpHeld(true);
        }}
        onPointerUp={() => {
          input.touchJump = false;
          setJumpHeld(false);
        }}
        onPointerCancel={() => {
          input.touchJump = false;
          setJumpHeld(false);
        }}
      >
        JUMP
      </div>
    </div>
  );
}
