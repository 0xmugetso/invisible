// An abstract routing diagram. The traces are decorative, so they carry no data labels.
export const networkTraces = Array.from({length: 27}, (_, index) => {
  const offset = (index - 13) * 13;
  return `M -60 ${360 + offset * .44} C 142 ${364 + offset * .5} 224 ${118 + offset * .58} 439 ${130 + offset * .75} S 670 ${360 + offset} 819 ${287 + offset * 1.1} S 962 ${54 + offset * .55} 1130 ${31 + offset * .65}`;
});
