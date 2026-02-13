export function playSound(sound: string, vol: number = 0.01): void {
    const snd = new Audio(sound);
    snd.volume = vol;
    snd.play();
}
