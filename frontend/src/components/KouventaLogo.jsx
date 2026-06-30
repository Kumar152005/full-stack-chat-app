const sizeClasses = {
  sm: {
    wrapper: "size-9 rounded-xl",
    svg: "size-6",
  },
  md: {
    wrapper: "size-12 rounded-2xl",
    svg: "size-8",
  },
  lg: {
    wrapper: "size-16 rounded-2xl",
    svg: "size-10",
  },
};

const KouventaLogo = ({ size = "sm", className = "" }) => {
  const classes = sizeClasses[size] || sizeClasses.sm;

  return (
    <div
      className={`${classes.wrapper} relative overflow-hidden bg-gradient-to-br from-primary via-secondary to-accent p-[2px] shadow-lg shadow-primary/20 ${className}`}
      aria-hidden="true"
    >
      <div className="h-full w-full rounded-[inherit] bg-base-100/90 flex items-center justify-center">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={classes.svg}
        >
          <path
            d="M12 14.5C12 10.9 14.9 8 18.5 8h11C33.1 8 36 10.9 36 14.5v8.2c0 3.6-2.9 6.5-6.5 6.5h-8.1L13 37v-8.2c-.7-1-1-2.1-1-3.4V14.5Z"
            className="fill-primary"
          />
          <path
            d="M19 17h10M19 23h6.5"
            className="stroke-primary-content"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M31.5 29.2 39 36.5"
            className="stroke-accent"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="m31 36 4-10 4 10-4-2.2L31 36Z"
            className="fill-secondary"
          />
        </svg>
      </div>
    </div>
  );
};

export default KouventaLogo;
